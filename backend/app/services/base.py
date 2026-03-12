from typing import Protocol

from app.models import BrainstormResponse


class TopicExpansionService(Protocol):
    def expand(self, topic: str) -> BrainstormResponse:
        """Expand an input topic into the phase-1 brainstorming cross."""
