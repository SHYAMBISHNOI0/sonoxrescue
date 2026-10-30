import os
import tempfile
import secrets
os.environ['SONORESCUE_DATA_DIR']=tempfile.mkdtemp(prefix='sonorescue-tests-')
os.environ['SESSION_SECRET']=secrets.token_hex(32)
os.environ['DEMO_PASSWORD']=secrets.token_urlsafe(20)
os.environ.pop('DATABASE_URL',None)
os.environ.pop('ORTHANC_URL',None)
import pytest
from fastapi.testclient import TestClient
from app.db import Base,engine
from app.main import app

@pytest.fixture(scope='session')
def client():
    Base.metadata.create_all(engine)
    with TestClient(app) as c:yield c

@pytest.fixture
def auth(client):
    def headers(role='Administrator'):
        from app.security import issue_token
        return {'Authorization':'Bearer '+issue_token(role,os.environ['DEMO_PASSWORD'])}
    return headers
