from copy import deepcopy
from uuid import uuid4
from sqlalchemy import select, func
from fastapi import HTTPException
from .db import Study, Investigation, Recovery, Experiment
from .repository import append_audit, create_case, persist_study, reset_demo, now
from .investigation import analyze
from .imaging import make_dicom
from .research import experiment

REVIEWERS={'Administrator','Radiology reviewer','Clinical safety reviewer'}

def execute_command(session,command,role,archive):
    if role=='Read-only observer':raise HTTPException(403,'Observers cannot modify the research environment.')
    before=after=''
    target=command.id or command.type
    if command.type=='reset':
        if role!='Administrator':raise HTTPException(403,'Administrator role required for reset.')
        reset_demo(session,archive);after='Demo fixtures restored; source archive and audit retained'
    elif command.type=='simulate':
        index=session.scalar(select(func.count()).select_from(Study))
        study=create_case(session,index,command.scenario,archive);target=study['id'];after='Synthetic workflow recorded'
    elif command.type=='experiment':
        if command.config is None:raise HTTPException(422,'Experiment configuration is required.')
        result=experiment(command.config)
        result.update(id=f'EXP-{uuid4().hex[:10]}',created=now())
        session.add(Experiment(id=result['id'],payload=result));target=result['id'];after='Measured experiment completed'
    elif command.type in {'assign','analyze'}:
        record=session.get(Investigation,command.id)
        if not record:raise HTTPException(404,'Investigation not found.')
        payload=deepcopy(record.payload);before=payload['status'];payload['reviewer']=f'Demo {role.lower()}';payload['status']='Investigating'
        if command.type=='analyze':payload['analysis']=analyze(session.get(Study,record.study_id).payload)
        record.payload=payload;after=payload['status']
    else:
        if role not in REVIEWERS:raise HTTPException(403,'Authorized reviewer role required.')
        record=session.get(Recovery,command.id)
        if not record:raise HTTPException(404,'Recovery action not found.')
        rec=deepcopy(record.payload)
        study_record=session.get(Study,rec['studyId'])
        study=deepcopy(study_record.payload)
        inferred=analyze(study)
        # Re-evaluate source constraints at every sensitive transition, never trust client flags.
        hard_conflict='identity' in inferred['issues'] or study['integrity']=='Identity conflict' or len(study['candidates'])!=1
        before=rec['status']
        expected={'approve':'Pending review','reject':'Pending review','execute':'Approved','verify':'Executed'}
        if rec['status']!=expected[command.type]:raise HTTPException(409,f'{command.type} requires state {expected[command.type]}.')
        if command.type!='reject' and hard_conflict:raise HTTPException(409,'Unresolved identity conflict or ambiguous orders. Automatic association is blocked.')
        if command.type=='approve':
            references={e['id'] for e in study['events'] if e['source'] in {'HIS','RIS','Modality'}}
            if not command.reason.strip() or command.evidence not in references:
                raise HTTPException(422,'Provide a reason and an existing HIS, RIS, or Modality source event ID as the independent verification reference.')
            rec.update(status='Approved',reason=command.reason,evidence=command.evidence,reviewer=f'Demo {role.lower()}',approvedBy=role,approvedAt=now())
        elif command.type=='reject':
            if not command.reason.strip():raise HTTPException(422,'A rejection reason is required.')
            rec.update(status='Rejected',reason=command.reason,reviewer=f'Demo {role.lower()}')
        elif command.type=='execute':
            # DICOM source identifiers remain unchanged; only a simulation association is added.
            receipt=archive.store(make_dicom(study))
            study['archiveReference']=receipt['reference'];study['archiveReceipt']=receipt
            study['reviewedAssociation']={'orderId':study['candidates'][0]['id'],'patient':study['candidates'][0]['patient'],'sourcePatient':study['patient'],'evidence':rec['evidence'],'reviewer':rec['reviewer']}
            rec.update(status='Executed',executedAt=now())
            study['events'].append({'id':f'EV-REC-{uuid4().hex[:12]}','type':'Storage accepted after reviewed action','source':'PACS','time':now(),'detail':f'Immutable source retained. Archive reference {receipt["reference"]}.','observed':True})
        elif command.type=='verify':
            if not study.get('reviewedAssociation'):raise HTTPException(409,'A reviewed association is required.')
            verification=archive.verify(study['archiveReference'],study)
            if study['reviewedAssociation']['orderId']!=study['candidates'][0]['id']:raise HTTPException(409,'Reviewed order relationship changed.')
            rec.update(status='Verified',verification=verification,verifiedAt=now())
            study.update(archive='Verified',integrity='Recovered',verification=verification)
            study['events'].append({'id':f'EV-VERIFY-{uuid4().hex[:12]}','type':'Archive retrieved','source':'Review station','time':now(),'detail':f'Study UID, original identifiers and reviewed association verified; SHA256 {verification["sha256"]}.','observed':True})
            inv_record=session.get(Investigation,rec['investigationId']);inv=deepcopy(inv_record.payload);inv['status']='Resolved';inv_record.payload=inv
        record.payload=rec
        persist_study(session,study)
        after=rec['status']
    append_audit(session,role,command.type,target,before,after,command.reason or 'User initiated synthetic workflow',command.evidence)
