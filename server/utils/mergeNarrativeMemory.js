function uniqueRecent(list, limit) {
  const safeList = Array.isArray(list) ? list : [];
  return [...new Set(safeList)].slice(-limit);
}

export function mergeNarrativeMemory(currentMemory, memoryUpdate, volume) {
  const current = currentMemory || {};
  const update = memoryUpdate || {};
  const safeVolume = Number(volume) || 0;

  const mergedThemes = uniqueRecent(
    [...(current.themesCovered || []), ...(update.themesAdded || [])],
    30
  );

  const mergedArcs = uniqueRecent(
    [...(current.arcsUsed || []), ...(update.arcsUsed || [])],
    10
  );

  const nextToneSequence = Array.isArray(update.lastToneSequence)
    ? update.lastToneSequence.slice(-5)
    : [];

  const nextTotalPosts = (Number(current.totalPostsGenerated) || 0) + safeVolume;

  return {
    themesCovered: mergedThemes,
    arcsUsed: mergedArcs,
    lastToneSequence: nextToneSequence,
    openArc: update.openArc ?? null,
    forbiddenNext: Array.isArray(update.forbiddenNext) ? update.forbiddenNext : [],
    totalPostsGenerated: nextTotalPosts,
  };
}
