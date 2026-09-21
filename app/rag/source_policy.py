ALLOWED_SOURCE_ORGS = {
    "질병관리청",
    "보건복지부",
    "국민건강보험공단",
    "대한의학회",
    "대한비만학회",
    "대한당뇨병학회",
    "대한고혈압학회",
    "한국지질·동맥경화학회",
    "WHO",
    "CDC",
    "NIH",
    "ACSM",
}

ALLOWED_DOCUMENT_TYPES = {
    "clinical_guideline",
    "official_guideline",
    "public_health_guideline",
    "systematic_review",
    "meta_analysis",
    "peer_reviewed_review",
}

BLOCKED_SOURCE_TYPES = {
    "blog",
    "community",
    "forum",
    "advertisement",
    "influencer",
    "unverified_summary",
}


def is_allowed_source(
    source_org: str,
    document_type: str,
    verified: bool,
) -> bool:
    if not verified:
        return False

    if source_org not in ALLOWED_SOURCE_ORGS:
        return False

    if document_type not in ALLOWED_DOCUMENT_TYPES:
        return False

    return True