/** Konva 的 find 只支持 #id 选择器，图形用固定前缀的 id 方便拖动时定位。 */
export function edgeShapeId(edgeId: string) {
  return `edge-${edgeId}`
}

export function nodeShapeId(nodeId: string) {
  return `node-${nodeId}`
}
