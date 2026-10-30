"""Small synthetic DICOM archive adapter, with optional real Orthanc transport."""
import io
import os
import hashlib
from pathlib import Path
from datetime import datetime
import httpx
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, SecondaryCaptureImageStorage, UID
from .db import DATA_DIR

MAX_DICOM_BYTES = 16 * 1024 * 1024

def make_dicom(study):
    meta = FileMetaDataset()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    meta.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
    meta.MediaStorageSOPInstanceUID = f'{study["uid"]}.1.1'
    meta.ImplementationClassUID = '1.2.826.0.1.3680043.10.543.99'
    ds = FileDataset(None, {}, file_meta=meta, preamble=b'\0'*128)
    ds.SOPClassUID = meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID = study['uid']
    ds.SeriesInstanceUID = f'{study["uid"]}.1'
    ds.PatientID = study['patient']
    ds.PatientName = 'SYNTHETIC^PHANTOM'
    ds.IssuerOfPatientID = study['issuer']
    ds.AccessionNumber = study['accession']
    ds.Modality = study['modality']
    ds.StudyDescription = 'SonoRescue synthetic phantom - not clinical'
    ds.StationName = study['device']
    timestamp = datetime.fromisoformat(study['time'])
    ds.StudyDate = timestamp.strftime('%Y%m%d')
    ds.StudyTime = timestamp.strftime('%H%M%S')
    ds.SeriesNumber = 1
    ds.InstanceNumber = 1
    ds.Rows = ds.Columns = 64
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = 'MONOCHROME2'
    ds.BitsAllocated = ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.BurnedInAnnotation = 'NO'
    ds.PixelData = bytes(180 if (x-32)**2/500+(y-32)**2/800<1 else 12 for y in range(64) for x in range(64))
    output = io.BytesIO()
    ds.save_as(output, enforce_file_format=True)
    return output.getvalue()

def extract_metadata(blob):
    if not blob or len(blob)>MAX_DICOM_BYTES:
        raise ValueError('DICOM payload must be between 1 byte and 16 MiB.')
    try:
        ds = pydicom.dcmread(io.BytesIO(blob), stop_before_pixels=True)
    except Exception as exc:
        raise ValueError('Invalid DICOM file or missing file meta information.') from exc
    fields = ['PatientID','IssuerOfPatientID','AccessionNumber','StudyInstanceUID','SeriesInstanceUID','SOPInstanceUID','StudyDate','StudyTime','Modality','StationName','StudyDescription']
    values = {key: str(getattr(ds,key,'')) for key in fields}
    warnings = []
    for field in ['StudyInstanceUID','SeriesInstanceUID','SOPInstanceUID']:
        if not values[field] or not UID(values[field]).is_valid:
            raise ValueError(f'Invalid or absent {field}.')
    for field in ['PatientID','IssuerOfPatientID','AccessionNumber']:
        if not values[field]: warnings.append(f'Missing {field}')
    for field,fmt in [('StudyDate','%Y%m%d'),('StudyTime','%H%M%S')]:
        try: datetime.strptime(values[field].split('.')[0],fmt)
        except ValueError: warnings.append(f'Invalid or absent {field}')
    return {'metadata':values,'warnings':warnings,'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob)}

class Archive:
    def __init__(self):
        self.url = os.getenv('ORTHANC_URL','').rstrip('/')
        self.root = DATA_DIR/'archive'
        self.root.mkdir(exist_ok=True)
    def client(self):
        return httpx.Client(base_url=self.url, auth=(os.getenv('ORTHANC_USER',''),os.getenv('ORTHANC_PASSWORD','')), timeout=10)
    def store(self, blob):
        metadata = extract_metadata(blob)
        if self.url:
            with self.client() as client:
                response = client.post('/instances',content=blob,headers={'Content-Type':'application/dicom'})
                response.raise_for_status()
                ref = response.json()['ID']
        else:
            ref = metadata['sha256']
            path = self.root/f'{ref}.dcm'
            # Content-addressed immutable evidence; never mutate an existing source file.
            if not path.exists(): path.write_bytes(blob)
        return {'reference':ref,'transportAcknowledged':True,'storageAccepted':True,'storageCommitment':False,'retrievalVerified':False,**metadata}
    def retrieve(self, reference):
        if not reference or not all(c in '0123456789abcdef-' for c in reference) or len(reference)>100:
            raise ValueError('Invalid archive reference.')
        if self.url:
            with self.client() as client:
                response=client.get(f'/instances/{reference}/file');response.raise_for_status();return response.content
        return (self.root/f'{reference}.dcm').read_bytes()
    def verify(self, reference, study):
        blob=self.retrieve(reference)
        parsed=extract_metadata(blob)
        tags=parsed['metadata']
        valid=tags['StudyInstanceUID']==study['uid'] and tags['PatientID']==study['patient'] and tags['IssuerOfPatientID']==study['issuer']
        if not valid: raise ValueError('Retrieved DICOM identifiers disagree with expected source identifiers.')
        return {**parsed,'retrievalVerified':True,'expectedPatient':study['patient'],'expectedStudyUID':study['uid'],'mode':'Orthanc' if self.url else 'Local immutable DICOM files'}
    def health(self):
        if not self.url:return {'name':'PACS archive','status':'Healthy','detail':'Local immutable DICOM-file adapter; Orthanc not configured'}
        try:
            with self.client() as client:client.get('/system').raise_for_status()
            return {'name':'PACS archive','status':'Healthy','detail':'Orthanc REST probe succeeded'}
        except httpx.HTTPError:return {'name':'PACS archive','status':'Unavailable','detail':'Orthanc probe failed; image integrity remains unknown'}
