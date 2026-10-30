"""Measured, reproducible event-level benchmark; truth is never passed to inference."""
from collections import Counter
from time import perf_counter
from .schemas import ExperimentConfig
from .simulation import generate, SCENARIOS
from .investigation import analyze

def experiment(config: ExperimentConfig, ablations=False):
    samples = [generate(i, list(SCENARIOS)[i % 8], config.seed, config) for i in range(config.count)]
    methods = [('Metadata validation', {}), ('Weighted event matching', {}), ('TEG-UR', {})]
    if ablations:
        methods += [('Without temporal information', {'temporal': False}), ('Without graph relationships', {'relationships': False}), ('Without uncertainty handling', {'uncertainty': False}), ('Metadata only ablation', {'method': 'Metadata validation'})]
    results = []
    for name, options in methods:
        counts = Counter()
        errors = Counter()
        runtimes = []
        for observations, truth in samples:
            started = perf_counter()
            inferred = analyze(observations, method=options.get('method', name if name in {'Metadata validation','Weighted event matching'} else 'TEG-UR'), threshold=config.threshold, abstention=config.abstention, **{k:v for k,v in options.items() if k!='method'})
            runtimes.append((perf_counter()-started)*1000)
            predicted, actual = inferred['detected'], truth['anomaly']
            counts['tp' if predicted and actual else 'fp' if predicted else 'fn' if actual else 'tn'] += 1
            counts['abstain'] += int(inferred['abstain'])
            counts['review'] += int(predicted or inferred['abstain'])
            if actual:
                counts['causeCorrect'] += int(bool(set(inferred['issues']) & set(truth['faults'])))
                counts['incidentCount'] += 1
            selected = inferred['selectedOrder']
            if selected:
                counts['accepted'] += 1
                safe = selected == truth['orderId'] and truth['recoverable']
                counts['unsafe'] += int(not safe)
                counts['matchingCorrect'] += int(selected==truth['orderId'])
            if predicted != actual:
                errors[truth['scenario']] += 1
        n = config.count
        ratio = lambda a,b: counts[a]/max(1,counts[b])
        results.append({'method': name, 'precision': counts['tp']/max(1,counts['tp']+counts['fp']), 'recall': counts['tp']/max(1,counts['tp']+counts['fn']), 'accuracy': (counts['tp']+counts['tn'])/n, 'unsafe':counts['unsafe']/n, 'unsafeAmongAccepted':ratio('unsafe','accepted'), 'abstention':counts['abstain']/n, 'falsePositive':counts['fp']/max(1,counts['fp']+counts['tn']), 'review':counts['review']/n, 'latency':sum(runtimes)/n, 'rootCauseAccuracy':ratio('causeCorrect','incidentCount'), 'candidateMatchingAccuracy':ratio('matchingCorrect','accepted'), 'acceptedCount':counts['accepted'], 'tp':counts['tp'],'fp':counts['fp'],'tn':counts['tn'],'fn':counts['fn'], 'errorByScenario':dict(errors)})
    return {'config':config.model_dump(), 'results':results, 'scope':'Event-level synthetic benchmark. No training or calibrated probabilities. Root-cause accuracy means at least one injected cause appears among hypotheses, not exact compound-cause recovery. Generator families are shared across seeds, so generalization to unseen failure families is untested. No clinical efficacy claim.', 'dataset':{'generator':'workflow-v1','seed':config.seed,'split':'held-out test seed','truthSeparated':True,'count':config.count}}
