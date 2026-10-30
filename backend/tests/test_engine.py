import copy
import pytest
from app.simulation import generate,SCENARIOS
from app.investigation import analyze
from app.schemas import ExperimentConfig
from app.research import experiment

@pytest.mark.parametrize('scenario',SCENARIOS)
def test_detects_scenarios_and_abstains_safely(scenario):
    study,truth=generate(12,scenario)
    before=copy.deepcopy(study)
    result=analyze(study)
    assert result['detected']==truth['anomaly']
    if scenario in {'identity','duplicate','acknowledgement'}:assert result['abstain']
    if scenario=='healthy':assert result['selectedOrder']==truth['orderId']
    assert study==before

def test_matching_accession_does_not_override_patient_conflict():
    study,_=generate(2,'identity')
    assert study['accession']==study['candidates'][0]['accession']
    result=analyze(study)
    assert 'identity' in result['issues']
    assert result['selectedOrder'] is None

def test_missing_acknowledgement_is_not_proven_loss():
    study,_=generate(1,'acknowledgement')
    result=analyze(study)
    assert any('not proof of permanent data loss' in h['explanation'] for h in result['hypotheses'])

def test_inference_does_not_read_scenario_labels():
    study,_=generate(4,'transfer')
    result=analyze(study)
    study['scenario']='healthy'
    assert analyze(study)==result

def test_no_authority_match_is_accepted():
    study,_=generate(3,'healthy');study['candidates'][0]['issuer']='OTHER-HOSPITAL'
    assert analyze(study)['abstain']

def test_temporal_contradiction_is_preserved():
    study,_=generate(3,'healthy')
    next(e for e in study['events'] if e['type']=='Scan acquired')['time']='2026-01-01T00:00:00+00:00'
    assert 'temporal' in analyze(study)['issues']

def test_experiment_reproducibility_and_confusion_counts():
    config=ExperimentConfig(count=64,seed=45,missing=.2,noise=15,faults=2)
    first=experiment(config,ablations=True);second=experiment(config,ablations=True)
    for a,b in zip(first['results'],second['results']):
        assert a.pop('latency')>=0 and b.pop('latency')>=0
        assert a==b
        assert a['tp']+a['fp']+a['tn']+a['fn']==config.count
    assert first['results'][2]['unsafe']==0
