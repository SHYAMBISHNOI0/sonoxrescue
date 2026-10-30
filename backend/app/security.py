"""Short-lived signed demo sessions. No default secret or password is shipped."""
import base64
import hashlib
import hmac
import json
import os
import time
from uuid import uuid4
from fastapi import Header, HTTPException

ROLES={'Administrator','Imaging technician','Radiology reviewer','Clinical safety reviewer','Read-only observer'}

def secret():
    value=os.getenv('SESSION_SECRET','')
    if len(value)<32:raise RuntimeError('SESSION_SECRET must be configured with at least 32 characters.')
    return value.encode()

def issue_token(role,password):
    expected=os.getenv('DEMO_PASSWORD','')
    if not expected or not hmac.compare_digest(expected,password):raise HTTPException(401,'Invalid demo credentials.')
    payload=base64.urlsafe_b64encode(json.dumps({'role':role,'exp':int(time.time())+3600,'nonce':uuid4().hex}).encode()).decode()
    signature=hmac.new(secret(),payload.encode(),hashlib.sha256).hexdigest()
    return f'{payload}.{signature}'

def authenticate(authorization: str = Header('')):
    try:
        scheme,token=authorization.split(' ',1)
        if scheme.lower()!='bearer':raise ValueError()
        payload,signature=token.split('.')
        if not hmac.compare_digest(hmac.new(secret(),payload.encode(),hashlib.sha256).hexdigest(),signature):raise ValueError()
        claims=json.loads(base64.urlsafe_b64decode(payload))
        if claims['exp']<time.time() or claims['role'] not in ROLES:raise ValueError()
        return claims['role']
    except (ValueError,KeyError,TypeError,json.JSONDecodeError):raise HTTPException(401,'Sign in with a valid, unexpired demo session.')
