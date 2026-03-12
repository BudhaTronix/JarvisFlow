from functools import lru_cache
from re import sub

from app.models import BrainstormResponse, DirectionalTopics, TopicNode
from app.services.base import TopicExpansionService


def _slugify(label: str) -> str:
    normalized = sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return normalized or "topic"


class StaticDatasetService:
    def expand(self, topic: str) -> BrainstormResponse:
        del topic
        return BrainstormResponse(
            root=TopicNode(
                id="biology",
                label="Biology",
                content="Study of living organisms",
            ),
            directions=DirectionalTopics(
                up=TopicNode(id="cells", label="Cells", content="Basic unit of life"),
                right=TopicNode(
                    id="genetics",
                    label="Genetics",
                    content="Study of genes and heredity",
                ),
                down=TopicNode(
                    id="ecology",
                    label="Ecology",
                    content="Study of organisms and environment",
                ),
                left=TopicNode(
                    id="human-body",
                    label="Human Body",
                    content="Organs, tissues, and systems",
                ),
            ),
            source="static",
        )


class PlaceholderDatasetService:
    def expand(self, topic: str) -> BrainstormResponse:
        clean_topic = topic.strip()
        root_id = _slugify(clean_topic)
        return BrainstormResponse(
            root=TopicNode(
                id=root_id,
                label=clean_topic,
                content=f"Brainstorming hub for {clean_topic}",
            ),
            directions=DirectionalTopics(
                up=TopicNode(
                    id=f"{root_id}-core-idea",
                    label="Core Idea",
                    content=f"Define the core concept behind {clean_topic}.",
                ),
                right=TopicNode(
                    id=f"{root_id}-applications",
                    label="Applications",
                    content=f"List the practical uses and outcomes of {clean_topic}.",
                ),
                down=TopicNode(
                    id=f"{root_id}-questions",
                    label="Questions",
                    content=f"Capture the open questions worth exploring about {clean_topic}.",
                ),
                left=TopicNode(
                    id=f"{root_id}-related-topics",
                    label="Related Topics",
                    content=f"Map adjacent ideas and connected themes around {clean_topic}.",
                ),
            ),
            source="placeholder",
        )


class PhaseOneTopicExpansionService:
    def __init__(
        self,
        static_service: StaticDatasetService | None = None,
        placeholder_service: PlaceholderDatasetService | None = None,
    ) -> None:
        self.static_service = static_service or StaticDatasetService()
        self.placeholder_service = placeholder_service or PlaceholderDatasetService()

    def expand(self, topic: str) -> BrainstormResponse:
        if not topic.strip():
            return self.static_service.expand(topic)
        return self.placeholder_service.expand(topic)


@lru_cache(maxsize=1)
def get_topic_expansion_service() -> TopicExpansionService:
    return PhaseOneTopicExpansionService()
