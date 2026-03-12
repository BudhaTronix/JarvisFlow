export type Direction = "up" | "right" | "down" | "left";

export interface TopicNodeData {
  id: string;
  label: string;
  content: string;
}

export interface BrainstormResponse {
  root: TopicNodeData;
  directions: Record<Direction, TopicNodeData>;
  source: "static" | "placeholder";
}

export type SelectedNode = "center" | Direction;

export const directionOrder: Direction[] = ["up", "right", "down", "left"];
