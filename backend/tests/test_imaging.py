import pytest
from app.simulation import generate
from app.imaging import Archive,make_dicom,extract_metadata

def test_dicom_roundtrip_and_real_retrieval():
    study,_=generate(5,'healthy');archive=Archive()
    blob=make_dicom(study);metadata=extract_metadata(blob)
    assert metadata['metadata']['StudyInstanceUID']==study['uid']
    assert metadata['metadata']['PatientID']==study['patient']
    receipt=archive.store(blob)
    assert receipt['storageAccepted'] and not receipt['retrievalVerified']
    assert archive.retrieve(receipt['reference'])==blob
    assert archive.verify(receipt['reference'],study)['retrievalVerified']

def test_identity_verification_fails_when_expected_identifier_changes():
    study,_=generate(2,'healthy');archive=Archive();receipt=archive.store(make_dicom(study))
    study['patient']='SYN-WRONG'
    with pytest.raises(ValueError,match='identifiers'):archive.verify(receipt['reference'],study)

def test_missing_fields_are_preserved_as_warnings():
    study,_=generate(1,'accession')
    assert 'Missing AccessionNumber' in extract_metadata(make_dicom(study))['warnings']

def test_bad_dicom_and_path_traversal_rejected():
    with pytest.raises(ValueError):extract_metadata(b'not a DICOM object')
    with pytest.raises(ValueError):Archive().retrieve('../../secret')
