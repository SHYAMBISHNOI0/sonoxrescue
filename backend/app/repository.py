import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import select, delete
from .db import Session, Patient, Device, Order, Study, WorkflowEvent, Investigation, Recovery, Audit, Experiment
from .simulation import generate, SCENARIOS
from .investigation import analyze
from .imaging import Archive, make_dicom

def now():
    return datetime.now(timezone.utc).isoformat()

def checksum(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def append_audit(session, role, action, target, before='', after='', reason='', evidence=''):
    latest=session.scalar(select(Audit).order_by(Audit.sequence.desc()).limit(1))
    previous=latest.digest if latest else '0'*64
    payload={'id':f'AUD-{uuid4().hex[:12]}','actor':f'Demo {role.lower()}','role':role,'action':action,'target':target,'time':now(),'before':before,'after':after,'reason':reason,'evidence':evidence,'correlation':str(uuid4())}
    digest=checksum({'previous':previous,'payload':payload})
    session.add(Audit(payload=payload,previous_hash=previous,digest=digest))
    return payload

def audit_integrity(session):
    previous='0'*64
    entries=session.scalars(select(Audit).order_by(Audit.sequence)).all()
    for entry in entries:
        if entry.previous_hash!=previous or entry.digest!=checksum({'previous':previous,'payload':entry.payload}):
            return {'valid':False,'checked':entry.sequence,'note':'Hash chain mismatch detected.'}
        previous=entry.digest
    return {'valid':True,'checked':len(entries),'head':previous,'note':'Application-level tamper evidence only; a database administrator could rewrite the full chain.'}

def persist_study(session, study):
    for c in study['candidates']:
        if not session.get(Patient,c['patient']):
            session.add(Patient(id=c['patient'],authority=c['issuer']));session.flush()
        session.merge(Order(id=c['id'],patient_id=c['patient'],accession=c['accession'],payload=c))
    if not session.get(Device,study['device']):
        session.add(Device(id=study['device'],modality=study['modality']));session.flush()
    session.merge(Study(id=study['id'],uid=study['uid'],device_id=study['device'],patient_value=study['patient'],payload=study));session.flush()
    for event in study['events']:
        original=session.get(WorkflowEvent,event['id'])
        if original and original.payload!=event:
            raise ValueError('Original source events are immutable.')
        if not original:session.add(WorkflowEvent(id=event['id'],study_id=study['id'],source=event['source'],timestamp=event['time'],payload=event))

def create_case(session, index, scenario, archive, seed=42):
    study, _truth=generate(index,scenario,seed)
    inferred=analyze(study)
    study['scenario']=scenario  # Presentation only; never read by the inference engine.
    study['candidates']=inferred['candidates']
    if any(e['type']=='Storage accepted' for e in study['events']):
        receipt=archive.store(make_dicom(study))
        study['archiveReference']=receipt['reference']
        study['archiveReceipt']=receipt
        if scenario=='healthy':
            study['verification']=archive.verify(receipt['reference'],study)
    persist_study(session,study)
    if inferred['detected']:
        identifier=f'INV-{index+1:04d}'
        from datetime import timedelta
        detected=(datetime.fromisoformat(study['time'])+timedelta(minutes=8)).isoformat()
        inv={'id':identifier,'studyId':study['id'],'category':SCENARIOS[scenario],'severity':'Critical' if study['integrity']=='Identity conflict' else 'High' if scenario=='transfer' else 'Medium','status':'Open','reviewer':'Unassigned','detected':detected,'completeness':round(len(study['events'])/7*100),'analysis':inferred}
        session.add(Investigation(id=identifier,study_id=study['id'],payload=inv));session.flush()
        rec={'id':f'REC-{index+1}','investigationId':identifier,'studyId':study['id'],'action':'Retry simulated transfer' if scenario=='transfer' else 'Review evidence and reconcile simulation','status':'Pending review','reason':'','evidence':'','reviewer':'Unassigned'}
        session.add(Recovery(id=rec['id'],investigation_id=identifier,payload=rec))
    return study

def initialize(archive=None):
    archive=archive or Archive()
    with Session.begin() as session:
        if session.scalar(select(Study.id).limit(1)):return
        for i in range(32):create_case(session,i,list(SCENARIOS)[i] if i<8 else 'healthy',archive)
        append_audit(session,'Administrator','Initialize synthetic environment','Demo hospital',after='32 synthetic studies',reason='Deterministic seed 42')

def snapshot(session):
    return {'studies':[s.payload for s in session.scalars(select(Study).order_by(Study.id.desc()))], 'investigations':[s.payload for s in session.scalars(select(Investigation).order_by(Investigation.id.desc()))], 'recovery':[s.payload for s in session.scalars(select(Recovery).order_by(Recovery.id.desc()))], 'audit':[{**s.payload,'hash':s.digest,'previousHash':s.previous_hash} for s in session.scalars(select(Audit).order_by(Audit.sequence.desc()))], 'experiments':[s.payload for s in session.scalars(select(Experiment).order_by(Experiment.id.desc()))]}

def reset_demo(session,archive):
    # Audit history and archived source objects survive a reset.
    for model in [Recovery,Investigation,WorkflowEvent,Study,Order,Patient,Device,Experiment]:session.execute(delete(model))
    session.flush()
    for i in range(32):create_case(session,i,list(SCENARIOS)[i] if i<8 else 'healthy',archive)
