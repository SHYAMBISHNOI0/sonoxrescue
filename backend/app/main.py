import hashlib
import json
import logging
import os
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Depends, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from .db import Session, Study, Investigation, Recovery, Experiment, Idempotency, engine
from .schemas import Command, Login, SimulationRequest, ExperimentConfig, Decision
from .security import authenticate, issue_token, secret
from .repository import initialize, snapshot, checksum, audit_integrity, append_audit
from .commands import execute_command
from .imaging import Archive, extract_metadata, MAX_DICOM_BYTES
from .simulation import SCENARIOS
from .investigation import analyze

logger=logging.getLogger('sonorescue')
lock=threading.RLock()
archive=Archive()
attempts=defaultdict(deque)

@asynccontextmanager
async def lifespan(app):
    secret()
    if not os.getenv('DEMO_PASSWORD'):raise RuntimeError('DEMO_PASSWORD is required.')
    initialize(archive)
    yield

app=FastAPI(title='SonoRescue research API',version='0.1.0',description='Synthetic imaging integrity prototype. No clinical diagnosis or automatic identity reassignment.',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('CORS_ORIGINS','http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174').split(','),allow_methods=['GET','POST'],allow_headers=['Authorization','Content-Type','Idempotency-Key'])

@app.middleware('http')
async def request_log(request: Request, call_next):
    identifier=str(uuid4());start=time.perf_counter()
    response=await call_next(request)
    response.headers['X-Request-ID']=identifier
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Cache-Control']='no-store'
    logger.info(json.dumps({'request_id':identifier,'method':request.method,'path':request.url.path,'status':response.status_code,'elapsed_ms':round((time.perf_counter()-start)*1000,2)}))
    return response

@app.exception_handler(ValueError)
async def value_error(request,exc):return JSONResponse(status_code=422,content={'detail':str(exc),'code':'validation_error'})

@app.exception_handler(Exception)
async def internal_error(request,exc):
    logger.exception('Internal operation failed')
    return JSONResponse(status_code=503,content={'detail':'Operation unavailable. Source evidence was retained; inspect service health.','code':'service_unavailable'})

@app.get('/api/v1/health')
def health():return {'status':'ok','environment':'synthetic research prototype'}

@app.post('/api/v1/auth/token')
def token(body:Login,request:Request):
    address=request.client.host if request.client else 'unknown'
    recent=attempts[address];now=time.monotonic()
    while recent and recent[0]<now-60:recent.popleft()
    if len(recent)>=12:raise HTTPException(429,'Too many sign-in attempts; try again in a minute.')
    recent.append(now)
    return {'access_token':issue_token(body.role,body.password),'token_type':'bearer','expires_in':3600,'role':body.role}

@app.get('/api/v1/state')
def get_state(role=Depends(authenticate)):
    with Session() as session:return snapshot(session)

def mutate(command,role,key=None):
    with lock, Session.begin() as session:
        if engine.dialect.name=='postgresql':session.execute(text('SELECT pg_advisory_xact_lock(5376549)'))
        request_hash=checksum({'command':command.model_dump(),'role':role})
        identifier=f'{role}:{key}' if key else None
        if identifier:
            previous=session.get(Idempotency,identifier)
            if previous:
                if previous.request_hash!=request_hash:raise HTTPException(409,'Idempotency key was already used for a different command.')
                return previous.response
        execute_command(session,command,role,archive)
        session.flush()
        response=snapshot(session)
        if identifier:session.add(Idempotency(id=identifier,request_hash=request_hash,response=response))
        return response

@app.post('/api/v1/commands')
def commands(command:Command,role=Depends(authenticate),idempotency_key:str|None=Header(None,max_length=100)):
    return mutate(command,role,idempotency_key)

@app.get('/api/v1/studies')
def studies(q:str='',modality:str='',status:str='',offset:int=Query(0,ge=0),limit:int=Query(25,ge=1,le=200),role=Depends(authenticate)):
    with Session() as session:
        rows=[s.payload for s in session.scalars(select(Study).order_by(Study.id.desc()))]
        rows=[s for s in rows if q.lower() in json.dumps(s).lower() and (not modality or s['modality']==modality) and (not status or s['archive']==status)]
        return {'items':rows[offset:offset+limit],'total':len(rows),'offset':offset,'limit':limit}

def study_by_id(identifier):
    with Session() as session:
        record=session.get(Study,identifier)
        if not record:raise HTTPException(404,'Study not found.')
        return record.payload

@app.get('/api/v1/studies/{identifier}')
def study_detail(identifier:str,role=Depends(authenticate)):return study_by_id(identifier)

@app.get('/api/v1/studies/{identifier}/events')
def study_events(identifier:str,role=Depends(authenticate)):return study_by_id(identifier)['events']

@app.get('/api/v1/studies/{identifier}/metadata')
def metadata(identifier:str,role=Depends(authenticate)):
    study=study_by_id(identifier)
    if not study.get('archiveReference'):raise HTTPException(409,'No archive object is available; acquisition metadata remains in the study record.')
    return extract_metadata(archive.retrieve(study['archiveReference']))

@app.get('/api/v1/studies/{identifier}/dicom')
def dicom(identifier:str,role=Depends(authenticate)):
    study=study_by_id(identifier)
    if not study.get('archiveReference'):raise HTTPException(409,'DICOM retrieval unavailable.')
    return Response(archive.retrieve(study['archiveReference']),media_type='application/dicom',headers={'Content-Disposition':f'attachment; filename="{identifier}.dcm"'})

@app.post('/api/v1/dicom/inspect')
async def inspect(request:Request,role=Depends(authenticate)):
    if role=='Read-only observer':raise HTTPException(403,'DICOM inspection uploads require a technician or reviewer role.')
    body=bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body)>MAX_DICOM_BYTES:raise HTTPException(413,'DICOM upload exceeds the 16 MiB limit.')
    return extract_metadata(bytes(body))

@app.get('/api/v1/investigations')
def investigations(role=Depends(authenticate)):
    with Session() as session:return [s.payload for s in session.scalars(select(Investigation))]

@app.get('/api/v1/investigations/{identifier}')
def investigation(identifier:str,role=Depends(authenticate)):
    with Session() as session:
        record=session.get(Investigation,identifier)
        if not record:raise HTTPException(404,'Investigation not found.')
        return record.payload

@app.get('/api/v1/investigations/{identifier}/{section}')
def evidence(identifier:str,section:str,role=Depends(authenticate)):
    inv=investigation(identifier,role)
    result=analyze(study_by_id(inv['studyId']))
    if section=='graph':return result['graph']
    if section=='candidates':return result['candidates']
    if section=='evidence':return {'analysis':result,'events':study_by_id(inv['studyId'])['events']}
    raise HTTPException(404,'Unknown investigation section.')

@app.post('/api/v1/investigations/{identifier}/analyze')
def analyze_case(identifier:str,role=Depends(authenticate)):return mutate(Command(type='analyze',id=identifier),role)

@app.get('/api/v1/recovery/actions')
def recovery_actions(role=Depends(authenticate)):
    with Session() as session:return [r.payload for r in session.scalars(select(Recovery))]

@app.post('/api/v1/recovery/actions/{identifier}/{operation}')
def recover(identifier:str,operation:str,body:Decision,role=Depends(authenticate),idempotency_key:str|None=Header(None,max_length=100)):
    if operation not in {'approve','reject','execute','verify'}:raise HTTPException(404,'Unknown recovery operation.')
    return mutate(Command(type=operation,id=identifier,reason=body.reason,evidence=body.evidence),role,idempotency_key)

@app.get('/api/v1/simulation/scenarios')
def scenarios(role=Depends(authenticate)):return [{'id':key,'title':title} for key,title in SCENARIOS.items()]

@app.post('/api/v1/simulation/runs')
def simulate(body:SimulationRequest,role=Depends(authenticate),idempotency_key:str|None=Header(None,max_length=100)):
    return mutate(Command(type='simulate',scenario=body.scenario),role,idempotency_key)

@app.post('/api/v1/research/experiments')
def run_experiment(body:ExperimentConfig,role=Depends(authenticate)):return mutate(Command(type='experiment',config=body),role)

@app.get('/api/v1/research/experiments/{identifier}')
@app.get('/api/v1/research/experiments/{identifier}/results')
def results(identifier:str,role=Depends(authenticate)):
    with Session() as session:
        record=session.get(Experiment,identifier)
        if not record:raise HTTPException(404,'Experiment not found.')
        return record.payload

@app.get('/api/v1/audit/events')
def audit(offset:int=Query(0,ge=0),limit:int=Query(50,ge=1,le=200),role=Depends(authenticate)):
    with Session() as session:
        rows=snapshot(session)['audit'];return {'items':rows[offset:offset+limit],'total':len(rows),'integrity':audit_integrity(session)}

@app.get('/api/v1/audit/export')
def export_audit(role=Depends(authenticate)):
    if role!='Administrator':raise HTTPException(403,'Administrator role required for audit exports.')
    with Session.begin() as session:
        append_audit(session,role,'audit export','Audit trail',reason='Authorized synthetic audit export');session.flush();return snapshot(session)['audit']

@app.get('/api/v1/dashboard/{section}')
def dashboard(section:str,role=Depends(authenticate)):
    with Session() as session:state=snapshot(session)
    studies=state['studies']
    if section=='summary':return {'total':len(studies),'verified':sum(s['archive']=='Verified' for s in studies),'investigations':sum(i['status']!='Resolved' for i in state['investigations']),'pending':sum(r['status']=='Pending review' for r in state['recovery'])}
    if section=='activity':return state['audit'][:20]
    if section=='pipeline':return {stage:sum(any(e['type']==stage for e in s['events']) for s in studies) for stage in ['Order created','Scan acquired','Transfer attempted','Storage accepted','Archive retrieved']}
    raise HTTPException(404,'Unknown dashboard section.')

@app.get('/api/v1/system/services')
def services(role=Depends(authenticate)):
    with Session() as session:session.execute(text('SELECT 1'))
    return [archive.health(),{'name':'Workflow database','status':'Healthy','detail':f'{engine.dialect.name} query succeeded'}, {'name':'Investigation engine','status':'Healthy','detail':'In-process deterministic graph analysis'}, {'name':'Background processing','status':'Unknown','detail':'No background worker; commands execute synchronously'}, *[{'name':name,'status':'Healthy','detail':'In-process synthetic source generator'} for name in ['Hospital information service','Radiology scheduling','Imaging device simulator','DICOM transfer service']]]
