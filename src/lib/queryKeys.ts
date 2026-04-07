export const queryKeys = {
  me: ['me'] as const,
  assetsCatalog: ['assets', 'catalog'] as const,
  assetsMine: ['assets', 'mine'] as const,
  sessionsList: ['sessions', 'list'] as const,
  sessionsDetail: (id: string) => ['sessions', 'detail', id] as const,
}
