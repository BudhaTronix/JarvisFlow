from functools import lru_cache
from re import sub

from app.models import BrainstormPage, BrainstormResponse, DirectionalTopics, TopicNode
from app.services.base import TopicExpansionService


def _slugify(label: str) -> str:
    normalized = sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return normalized or "topic"


def _topic(label: str, content: str, topic_id: str | None = None) -> TopicNode:
    return TopicNode(
        id=topic_id or _slugify(label),
        label=label,
        content=content,
    )


def _page(
    page_id: str,
    title: str,
    root: TopicNode,
    *,
    up: TopicNode,
    right: TopicNode,
    down: TopicNode,
    left: TopicNode,
) -> BrainstormPage:
    return BrainstormPage(
        id=page_id,
        title=title,
        root=root,
        directions=DirectionalTopics(
            up=up,
            right=right,
            down=down,
            left=left,
        ),
    )


def _response_from_pages(source: str, pages: list[BrainstormPage]) -> BrainstormResponse:
    first_page = pages[0]
    return BrainstormResponse(
        root=first_page.root,
        directions=first_page.directions,
        pages=pages,
        source=source,
    )


class StaticDatasetService:
    def expand(self, topic: str) -> BrainstormResponse:
        del topic
        pages = [
            _page(
                "biology-foundations",
                "Foundations",
                _topic("Biology", "Study of living organisms", "biology"),
                up=_topic("Cells", "Basic unit of life", "cells"),
                right=_topic("Genetics", "Study of genes and heredity", "genetics"),
                down=_topic("Ecology", "Study of organisms and environment", "ecology"),
                left=_topic("Human Body", "Organs, tissues, and systems", "human-body"),
            ),
            _page(
                "biology-systems",
                "Systems",
                _topic("Cell Biology", "How cells organize growth, energy, and repair"),
                up=_topic("Membranes", "Control what enters and exits the cell"),
                right=_topic("Metabolism", "Chemical reactions that power life"),
                down=_topic("Cell Cycle", "Stages of growth and division"),
                left=_topic("Microscopy", "Tools for observing small structures"),
            ),
            _page(
                "biology-diversity",
                "Diversity",
                _topic("Evolution", "How life changes, adapts, and diversifies over time"),
                up=_topic("Natural Selection", "Traits that improve survival become more common"),
                right=_topic("Speciation", "How new species emerge over time"),
                down=_topic("Fossils", "Evidence of life from the past"),
                left=_topic("Adaptation", "Features shaped by environment and pressure"),
            ),
        ]
        return _response_from_pages("static", pages)


class PlaceholderDatasetService:
    def expand(self, topic: str) -> BrainstormResponse:
        clean_topic = topic.strip()
        root_id = _slugify(clean_topic)
        pages = [
            _page(
                f"{root_id}-overview",
                "Overview",
                _topic(clean_topic, f"Brainstorming hub for {clean_topic}", root_id),
                up=_topic("Core Idea", f"Define the core concept behind {clean_topic}.", f"{root_id}-core-idea"),
                right=_topic(
                    "Applications",
                    f"List the practical uses and outcomes of {clean_topic}.",
                    f"{root_id}-applications",
                ),
                down=_topic(
                    "Questions",
                    f"Capture the open questions worth exploring about {clean_topic}.",
                    f"{root_id}-questions",
                ),
                left=_topic(
                    "Related Topics",
                    f"Map adjacent ideas and connected themes around {clean_topic}.",
                    f"{root_id}-related-topics",
                ),
            ),
            _page(
                f"{root_id}-execution",
                "Execution",
                _topic(
                    f"{clean_topic} Plan",
                    f"Turn {clean_topic} into a more concrete roadmap with priorities and dependencies.",
                    f"{root_id}-plan",
                ),
                up=_topic("Audience", f"Identify who benefits most from {clean_topic} and why.", f"{root_id}-audience"),
                right=_topic("Workflow", f"Outline the key steps needed to execute {clean_topic}.", f"{root_id}-workflow"),
                down=_topic(
                    "Constraints",
                    f"List the blockers, limits, or assumptions around {clean_topic}.",
                    f"{root_id}-constraints",
                ),
                left=_topic(
                    "Resources",
                    f"Map the people, tools, and inputs required for {clean_topic}.",
                    f"{root_id}-resources",
                ),
            ),
            _page(
                f"{root_id}-expansion",
                "Expansion",
                _topic(
                    f"{clean_topic} Growth",
                    f"Explore how {clean_topic} could expand, improve, or create new value.",
                    f"{root_id}-growth",
                ),
                up=_topic(
                    "Opportunities",
                    f"Spot the biggest upside and whitespace around {clean_topic}.",
                    f"{root_id}-opportunities",
                ),
                right=_topic(
                    "Experiments",
                    f"Design fast tests to validate decisions connected to {clean_topic}.",
                    f"{root_id}-experiments",
                ),
                down=_topic(
                    "Risks",
                    f"Surface what could fail or slow down momentum for {clean_topic}.",
                    f"{root_id}-risks",
                ),
                left=_topic(
                    "Partnerships",
                    f"Find collaborators or adjacent teams that can strengthen {clean_topic}.",
                    f"{root_id}-partnerships",
                ),
            ),
        ]
        return _response_from_pages("placeholder", pages)


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
