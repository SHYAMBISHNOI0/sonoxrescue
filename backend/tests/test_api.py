from copy import deepcopy
from sqlalchemy import select
from app.db import Session,Audit
from app.repository import audit_integrity

def test_authentication_and_health(client,auth):
    assert client.get('/api/v1/health').status_code==200
    assert client.get('/api/v1/state').status_code==401
    assert client.get('/api/v1/state',headers={'Authorization':'Bearer invalid'}).status_code==401
    assert client.get('/api/v1/state',headers=auth()).status_code==200
    assert client.post('/api/v1/commands',headers=auth('Read-only observer'),json={'type':'simulate'}).status_code==403

def test_simulation_idempotency_and_healthy_no_incident(client,auth):
    headers={**auth(),'Idempotency-Key':'healthy-42'}
    before=client.get('/api/v1/state',headers=headers).json()
    a=client.post('/api/v1/commands',headers=headers,json={'type':'simulate','scenario':'healthy'})
    b=client.post('/api/v1/commands',headers=headers,json={'type':'simulate','scenario':'healthy'})
    assert a.status_code==b.status_code==200 and a.json()==b.json()
    assert len(a.json()['studies'])==len(before['studies'])+1
    assert len(a.json()['investigations'])==len(before['investigations'])
    assert client.post('/api/v1/commands',headers=headers,json={'type':'simulate','scenario':'identity'}).status_code==409

def test_recovery_requires_actual_retrieval_and_preserves_source(client,auth):
    headers=auth()
    state=client.post('/api/v1/commands',headers=headers,json={'type':'simulate','scenario':'transfer'}).json()
    study=state['studies'][0];original=deepcopy(study)
    recovery=next(r for r in state['recovery'] if r['studyId']==study['id'])
    def command(kind,**extra):return client.post('/api/v1/commands',headers=headers,json={'type':kind,'id':recovery['id'],**extra})
    assert command('execute').status_code==409
    assert command('approve',reason='Test',evidence='invented-reference').status_code==422
    evidence=next(e['id'] for e in study['events'] if e['source']=='RIS')
    assert command('approve',reason='Verified original acquisition',evidence=evidence).status_code==200
    assert command('verify').status_code==409
    executed=command('execute');assert executed.status_code==200
    assert next(s for s in executed.json()['studies'] if s['id']==study['id'])['integrity']!='Recovered'
    verified=command('verify');assert verified.status_code==200
    recovered=next(s for s in verified.json()['studies'] if s['id']==study['id'])
    assert recovered['integrity']=='Recovered'
    assert recovered['patient']==original['patient']
    assert recovered['verification']['retrievalVerified']
    assert recovered['events'][:len(original['events'])]==original['events']
    response=client.get(f'/api/v1/studies/{study["id"]}/dicom',headers=headers)
    assert response.status_code==200 and response.content[128:132]==b'DICM'

def test_identity_conflicts_and_observer_cannot_approve(client,auth):
    for scenario in ['identity','duplicate']:
        state=client.post('/api/v1/commands',headers=auth(),json={'type':'simulate','scenario':scenario}).json()
        study=state['studies'][0];rec=next(r for r in state['recovery'] if r['studyId']==study['id'])
        body={'type':'approve','id':rec['id'],'reason':'Review','evidence':study['events'][0]['id']}
        assert client.post('/api/v1/commands',headers=auth(),json=body).status_code==409
        assert client.post('/api/v1/commands',headers=auth('Imaging technician'),json=body).status_code==403

def test_api_validation_and_audit_export_authorization(client,auth):
    assert client.get('/api/v1/studies?limit=500',headers=auth()).status_code==422
    assert client.post('/api/v1/commands',headers=auth(),json={'type':'simulate','scenario':'invalid'}).status_code==422
    assert client.post('/api/v1/research/experiments',headers=auth(),json={'count':999999}).status_code==422
    assert client.get('/api/v1/audit/export',headers=auth('Read-only observer')).status_code==403
    assert client.get('/api/v1/audit/events',headers=auth()).json()['integrity']['valid']
    assert client.get('/openapi.json').status_code==200

def test_audit_detects_tampering_and_reset_retains_history(client,auth):
    with Session() as session:
        row=session.scalar(select(Audit).order_by(Audit.sequence).limit(1));original=deepcopy(row.payload)
        row.payload={**row.payload,'action':'tampered'};session.flush()
        assert not audit_integrity(session)['valid']
        session.rollback()
    before=client.get('/api/v1/state',headers=auth()).json()['audit']
    after=client.post('/api/v1/commands',headers=auth(),json={'type':'reset'}).json()['audit']
    assert len(after)>len(before)
    assert original['id'] in [a['id'] for a in after]
