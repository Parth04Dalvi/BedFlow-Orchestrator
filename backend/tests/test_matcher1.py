import pytest
from app.models.hospital import TriageAcuity
from app.services.matcher import compute_priority_score

def test_priority_score_ordering():
    esi1_score = compute_priority_score(TriageAcuity.ESI_1, wait_minutes=5, requires_vent=True, requires_iso=False)
    esi3_score = compute_priority_score(TriageAcuity.ESI_3, wait_minutes=15, requires_vent=False, requires_iso=False)
    esi5_score = compute_priority_score(TriageAcuity.ESI_5, wait_minutes=0, requires_vent=False, requires_iso=False)

    assert esi1_score > esi3_score
    assert esi3_score > esi5_score
    assert esi1_score == 1000.0 + (5 * 3.5) + 300.0
