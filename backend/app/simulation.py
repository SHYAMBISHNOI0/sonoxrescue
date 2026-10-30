"""Generator returns observations and ground truth separately. Inference never sees truth."""
from datetime import datetime, timedelta, timezone
from random import Random
from .schemas import ExperimentConfig

SCENARIOS = {
    'healthy': 'Healthy workflow', 'worklist': 'Worklist bypass',
    'accession': 'Missing accession', 'identity': 'Wrong patient identifier',
    'transfer': 'Interrupted transfer', 'acknowledgement': 'Missing archive confirmation',
    'duplicate': 'Ambiguous candidate orders', 'compound': 'Compound workflow failure',
}
STAGES = ['Patient registered', 'Order created', 'Worklist selected', 'Scan acquired', 'Transfer attempted', 'Storage accepted', 'Archive retrieved']
SOURCES = ['HIS', 'RIS', 'Modality', 'Modality', 'DICOM gateway', 'PACS', 'Review station']

def generate(index: int, scenario: str, seed: int = 42, config: ExperimentConfig | None = None):
    rng = Random(seed * 100003 + index)
    patient = f'SYN-{1040 + index:05d}'
    accession = f'ACC-26-{7200 + index}'
    modality = ['CT', 'US', 'MR'][index % 3]
    device = {'CT': 'CT-02', 'US': 'US-01', 'MR': 'MR-01'}[modality]
    acquired = datetime(2026, 10, 22, 5, tzinfo=timezone.utc) + timedelta(minutes=index * 7)
    faults = set() if scenario == 'healthy' else ({'accession', 'transfer'} if scenario == 'compound' else {scenario})
    if config and faults:
        other = list(SCENARIOS)[1:7]
        rng.shuffle(other)
        faults.update(other[:max(0, config.faults - 1)])
    if config and rng.random() < config.corruption:
        faults.add('identity')
    events = []
    for i, stage in enumerate(STAGES):
        if ('worklist' in faults and i == 2) or ('transfer' in faults and i > 4) or ('acknowledgement' in faults and i > 4):
            continue
        if config and rng.random() < config.missing:
            continue
        t = acquired + timedelta(minutes=i + (rng.uniform(-config.noise, config.noise) if config else 0))
        kind = 'Transfer failed' if i == 4 and 'transfer' in faults else stage
        events.append({'id': f'EV-{seed}-{index}-{i}', 'type': kind, 'source': SOURCES[i], 'time': t.isoformat(), 'detail': f'{kind} observed at {device}.', 'observed': True, 'patient': patient, 'orderId': f'ORD-{7200 + index}', 'device': device})
    candidates = [{'id': f'ORD-{7200 + index}', 'patient': patient, 'issuer': 'DEMO-HOSPITAL', 'accession': accession, 'modality': modality, 'device': device, 'delta': 4, 'score': 0, 'conflict': False, 'evidence': ['Scheduling record', 'Device acquisition log']}]
    if 'duplicate' in faults:
        candidates.append({**candidates[0], 'id': f'ORD-{8200 + index}', 'patient': f'SYN-{2040 + index:05d}', 'delta': 5})
        # No direct order lineage remains, so similar candidates stay ambiguous.
        for e in events:
            e.pop('orderId', None)
    if 'identity' in faults:
        # Plausible but wrong candidate to evaluate unsafe matching by baselines.
        candidates.append({**candidates[0], 'id': f'ORD-DECOY-{index}', 'patient': 'SYN-99999', 'delta': 2})
    displayed_patient = 'SYN-99999' if 'identity' in faults else f'LOCAL-{index}' if 'worklist' in faults else patient
    study = {'id': f'ST-{index + 1:04d}', 'uid': f'1.2.826.0.1.3680043.10.543.{seed}.{1000 + index}', 'patient': displayed_patient, 'issuer': 'DEMO-HOSPITAL', 'accession': '' if faults & {'accession', 'worklist'} else accession, 'modality': modality, 'description': ['Chest examination', 'Abdominal examination', 'Spine examination'][index % 3], 'device': device, 'system': 'North wing' if index % 2 else 'Main campus', 'time': acquired.isoformat(), 'archive': 'Transfer failed' if 'transfer' in faults else 'Unverified' if faults else 'Verified', 'integrity': 'Identity conflict' if faults & {'identity', 'duplicate'} else 'Needs review' if faults else 'Healthy', 'events': events, 'candidates': candidates}
    truth = {'anomaly': bool(faults), 'faults': sorted(faults), 'orderId': candidates[0]['id'], 'patient': patient, 'recoverable': not bool(faults & {'identity', 'duplicate'}), 'seed': seed, 'index': index, 'scenario': scenario}
    return study, truth
