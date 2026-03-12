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


class BrainstormResponse(BaseModel):
    root: TopicNode
    directions: DirectionalTopics
    source: Literal["static", "placeholder"]


class BrainstormRequest(BaseModel):
    topic: str = Field(default="")
