from fastapi import APIRouter, Depends

from app.models import BrainstormRequest, BrainstormResponse
from app.services.base import TopicExpansionService
from app.services.phase_one import get_topic_expansion_service

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/brainstorm", response_model=BrainstormResponse)
def brainstorm(
    request: BrainstormRequest,
    service: TopicExpansionService = Depends(get_topic_expansion_service),
) -> BrainstormResponse:
    return service.expand(request.topic)
