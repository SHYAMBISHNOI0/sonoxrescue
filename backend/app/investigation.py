"""Interpretable graph, temporal checks and selective candidate decisions."""
from datetime import datetime
import networkx as nx

def evidence_graph(study):
    graph = nx.DiGraph()
    def node(identifier, kind, **props):
        if 'type' in props:props['eventType']=props.pop('type')
        graph.add_node(identifier, type=kind, **props)
    node(study['id'], 'DICOM study', uid=study['uid'])
    node(study['patient'], 'Patient identity', authority=study['issuer'])
    node(study['device'], 'Imaging device')
    graph.add_edge(study['id'], study['patient'], type='associated with', observed=True, source='DICOM metadata')
    graph.add_edge(study['id'], study['device'], type='acquired by', observed=True, source='DICOM metadata')
    previous = None
    for event in sorted(study['events'], key=lambda e: e['time']):
        node(event['id'], 'Workflow event', **event)
        graph.add_edge(study['id'], event['id'], type='derived from', observed=True, evidence=event['id'], timestamp=event['time'])
        if previous:
            graph.add_edge(previous, event['id'], type='precedes', observed=True, evidence=[previous, event['id']])
        previous = event['id']
    for candidate in study['candidates']:
        node(candidate['id'], 'Imaging order', patient=candidate['patient'], accession=candidate['accession'])
        graph.add_edge(study['id'], candidate['id'], type='possible match', observed=False, source='Candidate generation', support='Requires verification')
    return {'nodes': [{'id': identifier, **props} for identifier, props in graph.nodes(data=True)], 'edges': [{'source': a, 'target': b, **props} for a, b, props in graph.edges(data=True)]}

def analyze(study, *, method='TEG-UR', threshold=.5, abstention=.8, temporal=True, relationships=True, uncertainty=True):
    events = study['events']
    types = {e['type'] for e in events}
    issues = []
    hypotheses = []
    def finding(code, explanation, supports, missing=()):
        issues.append(code)
        hypotheses.append({'code': code, 'explanation': explanation, 'support': 'Supported hypothesis', 'evidence': [e['id'] for e in events if e['type'] in supports], 'contradictoryEvidence': [], 'missingEvidence': list(missing)})
    metadata_bad = not study.get('accession') or not study.get('patient') or not study.get('issuer')
    source_patients = {e.get('patient') for e in events if e.get('patient')}
    identity_conflict = bool(source_patients and study['patient'] not in source_patients and not study['patient'].startswith('LOCAL-'))
    if metadata_bad:
        finding('accession', 'Required association metadata is absent.', ['Scan acquired'], ['Independent order verification'])
    if identity_conflict:
        finding('identity', 'DICOM patient identifier conflicts with source lineage.', ['Order created', 'Scan acquired'])
    if method != 'Metadata validation':
        if 'Scan acquired' in types and 'Worklist selected' not in types:
            finding('worklist', 'Possible worklist bypass or missing worklist log.', ['Scan acquired'], ['Original modality worklist log'])
        if 'Transfer failed' in types:
            finding('transfer', 'A failed transport attempt was recorded.', ['Transfer failed'])
        if 'Scan acquired' in types and 'Archive retrieved' not in types:
            finding('acknowledgement', 'Archive retrieval is unconfirmed; this is not proof of permanent data loss.', ['Transfer attempted', 'Storage accepted'], ['Successful archive retrieval'])
        if len(study['candidates']) > 1:
            finding('duplicate', 'Multiple candidate orders need explicit disambiguation.', ['Order created'])
    event_times = {e['type']: datetime.fromisoformat(e['time']) for e in events}
    temporal_conflict = temporal and 'Scan acquired' in event_times and 'Order created' in event_times and event_times['Scan acquired'] < event_times['Order created']
    if method == 'TEG-UR' and temporal_conflict:
        finding('temporal', 'Acquisition precedes its order in observed timestamps; clock skew is an alternative.', ['Scan acquired', 'Order created'], ['Device clock reconciliation'])
    candidates = []
    for c in study['candidates']:
        conflict = identity_conflict or (c['patient'] != study['patient'] and not study['patient'].startswith('LOCAL-')) or c['issuer'] != study['issuer']
        lineage = relationships and any(e.get('orderId') == c['id'] and e.get('patient') == c['patient'] for e in events)
        features = {'patient': float(c['patient'] == study['patient'] and c['issuer'] == study['issuer']), 'accession': float(bool(study['accession']) and c['accession'] == study['accession']), 'modality': float(c['modality'] == study['modality']), 'device': float(c.get('device') == study['device']), 'time': max(0, 1-c['delta']/60) if temporal else 0, 'lineage': float(lineage)}
        score = sum(features[k]*w for k,w in {'patient':.3,'accession':.25,'modality':.1,'device':.1,'time':.1,'lineage':.15}.items())
        candidates.append({**c, 'score': round(score*100, 2), 'conflict': conflict, 'features': features, 'lineage': lineage})
    candidates.sort(key=lambda c: c['score'], reverse=True)
    best = candidates[0] if candidates else None
    ambiguous = len(candidates)>1 and candidates[0]['score']-candidates[1]['score']<15
    support = len(types & {'Order created','Worklist selected','Scan acquired','Archive retrieved'})/4
    hold = best is None or best['score']/100<threshold
    if method == 'TEG-UR' and uncertainty:
        hold = hold or identity_conflict or bool(best and best['conflict']) or ambiguous or support<abstention or temporal_conflict or not bool(best and best['lineage'])
    if method == 'Metadata validation':
        issues = [i for i in issues if i in {'accession', 'identity'}]
    decision = 'Conflicting identity information' if identity_conflict else 'Additional evidence required' if hold else 'Human verification required'
    return {'detected': bool(issues), 'issues': issues, 'hypotheses': hypotheses, 'candidates': candidates, 'abstain': hold, 'selectedOrder': None if hold or not best else best['id'], 'uncertainty': decision, 'support': support, 'graph': evidence_graph(study) if method == 'TEG-UR' else None, 'limitations': 'Observed source events support hypotheses, not confirmed causal attribution. Ranking is not calibrated probability.'}
