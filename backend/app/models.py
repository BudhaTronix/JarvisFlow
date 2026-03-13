from typing import Literal

from pydantic import BaseModel, Field


class TopicNode(BaseModel):
    id: str
    label: str
    content: str


class DirectionalTopics(BaseModel):
    up: TopicNode
    right: TopicNode
    down: TopicNode
    left: TopicNode


class BrainstormPage(BaseModel):
    id: str
    title: str
    root: TopicNode
    directions: DirectionalTopics


class BrainstormResponse(BaseModel):
    root: TopicNode
    directions: DirectionalTopics
    pages: list[BrainstormPage] = Field(default_factory=list)
    source: Literal["static", "placeholder"]


class BrainstormRequest(BaseModel):
    topic: str = Field(default="")
