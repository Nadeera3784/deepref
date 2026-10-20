import uuid

import jwt
import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_round_trip() -> None:
    hashed = hash_password("correct horse battery")
    assert hashed != "correct horse battery"
    assert verify_password("correct horse battery", hashed)
    assert not verify_password("wrong", hashed)


def test_unknown_user_never_verifies() -> None:
    assert not verify_password("anything", None)


def test_token_round_trip() -> None:
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id, "admin")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "admin"
    assert expires_in > 0


def test_tampered_token_is_rejected() -> None:
    token, _ = create_access_token(uuid.uuid4(), "user")
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token[:-2] + ("aa" if not token.endswith("aa") else "bb"))
