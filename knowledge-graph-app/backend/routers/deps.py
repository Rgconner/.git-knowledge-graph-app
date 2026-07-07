"""FastAPI dependencies shared across routers.

get_current_user is a placeholder that returns a hardcoded user dict with id=1.
It will be replaced in Sub-Task 9 with real JWT validation.
"""

from typing import Annotated

from fastapi import Depends


def _placeholder_current_user() -> dict:
    """Temporary stub — always returns user id=1.  Replaced in Sub-Task 9."""
    return {"id": 1}


# Convenient type alias so routers can write: user: CurrentUser
CurrentUser = Annotated[dict, Depends(_placeholder_current_user)]
