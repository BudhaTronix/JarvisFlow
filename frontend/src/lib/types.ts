export type Direction = "up" | "right" | "down" | "left";

export interface TopicNodeData {
  id: string;
  label: string;
  content: string;
}

export interface BrainstormPageData {
  id: string;
  title: string;
  root: TopicNodeData;
  directions: Record<Direction, TopicNodeData>;
}

export interface BrainstormResponse {
  root: TopicNodeData;
  directions: Record<Direction, TopicNodeData>;
  pages: BrainstormPageData[];
  source: "static" | "placeholder";
}

export type SelectedNode = "center" | Direction;

export interface ScreenPoint {
  x: number;
  y: number;
}

export type TopicPositions = Record<SelectedNode, ScreenPoint>;

export const directionOrder: Direction[] = ["up", "right", "down", "left"];
export const TRIGGER_LINE_Y = 0.9;
export const TRIGGER_BAND_HALF_HEIGHT = 0.045;
export const TRIGGER_PROXIMITY_RANGE = 0.3;
