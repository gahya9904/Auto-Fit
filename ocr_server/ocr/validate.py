"""
값 검증 · 교차검증 · 신뢰도 판정.

엔진이 무엇이든(자체 OCR 파서든 외부 KIE 서비스든)
'뽑아낸 값이 말이 되는가'를 판단하는 규칙은 똑같아야 한다.
그래서 이 부분만 따로 떼어 두 경로가 함께 쓴다.

    자체 파서  ─┐
                ├─→ validate.py ─→ 저장 / 사용자 확인 화면
    외부 KIE   ─┘

KIE 서비스는 값을 뽑아 주지만 '체지방률 250%' 같은 헛값을 걸러 주지는 않는다.
그 책임은 어느 경우에도 우리에게 있다.
"""

import re
from difflib import SequenceMatcher
from typing import List, Optional

from .normalize import clean_label, to_date, to_number

# 신뢰도 구간 (schema 의 output_contract 와 항상 같게 유지할 것)
CONF_OK = 0.85
CONF_REVIEW = 0.5


def status_for(confidence: float, value=None) -> str:
    """신뢰도를 사용자 확인 화면의 동작으로 바꾼다."""
    if value is None:
        return "fail"
    if confidence >= CONF_OK:
        return "ok"
    if confidence >= CONF_REVIEW:
        return "review"
    return "fail"


def parse_value(text: str, field: dict) -> Optional[object]:
    """글자를 항목의 자료형에 맞는 값으로 바꾼다. 말이 안 되면 None."""
    ftype = field["type"]

    if ftype == "date":
        return to_date(text)

    if ftype == "enum":
        # 값도 항목명처럼 조금씩 틀리게 읽히고('여성'→'며성'),
        # 다른 정보와 한 칸에 붙어 나오기도 한다('남 / 55세').
        raw_map = field.get("raw_map") or {}
        allowed = list(raw_map.items()) + [(v, v) for v in field.get("enum", [])]

        pieces = [text] + re.split(r"[\s/,|]+", text)
        best, best_score = None, 0.0
        for piece in pieces:
            cleaned = clean_label(piece)
            if not cleaned:
                continue
            for raw, mapped in allowed:
                score = SequenceMatcher(None, cleaned, clean_label(raw)).ratio()
                if score > best_score:
                    best, best_score = mapped, score
        return best if best_score >= 0.8 else None

    if ftype == "string":
        t = text.strip()
        # '(좌/우)' 같은 괄호 안 보조 표기는 값이 아니다 (시력 칸에서 실제로 값 대신 잡혔다)
        if t.startswith("(") and t.endswith(")"):
            return None
        return t if len(t) >= 2 else None

    if ftype in ("int", "float"):
        value = to_number(text, max_value=field.get("max"), as_int=(ftype == "int"))
        return check_range(value, field)

    return None  # list 형태(처방 의약품)는 다음 단계에서


def check_range(value, field: dict):
    """유효범위를 벗어나면 값으로 인정하지 않는다.

    이 검사 하나가 많은 오답을 막는다.
    실제 사례: 신장 칸 아래의 'P1201'을 숫자 1201로 읽어도 100~220 밖이라 탈락.
    """
    if value is None:
        return None
    lo, hi = field.get("min"), field.get("max")
    if lo is not None and value < lo:
        return None
    if hi is not None and value > hi:
        return None
    if field["type"] == "float" and field.get("decimals") is not None:
        value = round(value, field["decimals"])
    return value


def coerce_value(raw, field: dict) -> Optional[object]:
    """외부 서비스가 돌려준 값을 우리 형식으로 맞춘다.

    KIE 서비스는 값을 문자열로 주기도 하고 숫자로 주기도 하며,
    단위를 붙여 주기도 한다('73.5 kg'). 어느 쪽이든 같은 검사를 통과해야 한다.
    """
    if raw is None or raw == "":
        return None
    if isinstance(raw, str):
        return parse_value(raw, field)
    if field["type"] in ("int", "float"):
        try:
            value = int(round(float(raw))) if field["type"] == "int" else float(raw)
        except (TypeError, ValueError):
            return None
        return check_range(value, field)
    return parse_value(str(raw), field)


def finalize(field: dict, value, confidence: float, source: str, raw_text=None) -> dict:
    """항목 하나의 최종 결과 묶음. 모든 엔진이 이 형식으로 돌려준다."""
    conf = round(min(max(float(confidence), 0.0), 1.0), 3) if value is not None else 0.0
    return {
        "value": value,
        "confidence": conf,
        "status": status_for(conf, value),
        "raw_text": raw_text,
        "method": source,
    }


def apply_cross_checks(result: dict) -> List[str]:
    """항목끼리 서로 대조해 오류를 잡고, 잃어버린 부호를 되살린다.

    OCR이든 KIE든 이 단계는 똑같이 필요하다.
    돌려주는 값은 사람이 읽을 수 있는 보정 기록.
    """
    notes: List[str] = []

    def val(key):
        item = result.get(key)
        return item["value"] if item and item["value"] is not None else None

    height, weight, bmi = val("height"), val("weight"), val("bmi")

    # ① BMI 재계산 대조 — 셋 중 하나를 잘못 읽었는지 확인
    if height and weight and bmi:
        calc = weight / ((height / 100) ** 2)
        if abs(calc - bmi) > 0.5:
            for key in ("height", "weight", "bmi"):
                if key in result:
                    result[key]["status"] = "review"
            notes.append(
                f"BMI 불일치: 문서값 {bmi} vs 계산값 {calc:.1f} → 신장·체중·BMI 모두 확인 필요"
            )

    # ② 체중조절 부호 복원 — OCR이 마이너스를 자주 놓친다
    ideal, wt_ctrl = val("ideal_wt"), val("wt_ctrl")
    if ideal and weight and wt_ctrl is not None:
        expected = ideal - weight
        if abs(abs(expected) - abs(wt_ctrl)) < 0.6 and expected * wt_ctrl < 0:
            result["wt_ctrl"]["value"] = round(expected, 1)
            notes.append(
                f"체중조절 부호 복원: {wt_ctrl} → {round(expected, 1)} (적정체중 {ideal} - 체중 {weight})"
            )

    # ③ 지방조절 부호 — 체중조절이 감량이면 지방조절도 감량으로 본다.
    #    추정이므로 자동 저장하지 않고 사용자 확인 대상으로 표시한다.
    wt_ctrl, fat_ctrl = val("wt_ctrl"), val("fat_ctrl")
    if wt_ctrl is not None and fat_ctrl is not None and wt_ctrl < 0 < fat_ctrl:
        result["fat_ctrl"]["value"] = -fat_ctrl
        result["fat_ctrl"]["status"] = "review"
        notes.append(f"지방조절 부호 추정: {fat_ctrl} → {-fat_ctrl} (확인 필요)")

    # ④ 혈압 앞뒤 뒤바뀜 — 수축기는 이완기보다 항상 크다
    sbp, dbp = val("sbp"), val("dbp")
    if sbp is not None and dbp is not None and sbp < dbp:
        result["sbp"]["value"], result["dbp"]["value"] = dbp, sbp
        result["sbp"]["status"] = result["dbp"]["status"] = "review"
        notes.append(f"혈압 순서 교정: {sbp}/{dbp} → {dbp}/{sbp} (확인 필요)")

    return notes
