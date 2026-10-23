// Quest (a.k.a. "task") definitions and evaluation. Ids and conditions are the v1 ones so old saves keep their progress.
// A quest is completed by a persisted stat reaching its target:
//   type 'score'         -> save.highScore
//   type 'waveCompleted' -> save.highestWaveCompleted
export const QUESTS = [
    { id: 'score5k', title: 'Reach a high score of 5,000', type: 'score', target: 5000 },
    { id: 'wave4', title: 'Complete wave 4', type: 'waveCompleted', target: 4 },
    { id: 'score15k', title: 'Reach a high score of 15,000', type: 'score', target: 15000 },
    { id: 'wave7', title: 'Complete wave 7', type: 'waveCompleted', target: 7 },
    { id: 'score25k', title: 'Reach a high score of 25,000', type: 'score', target: 25000 },
    { id: 'wave10', title: 'Complete wave 10', type: 'waveCompleted', target: 10 }
];

const STAT = {
    score: (save) => save.highScore,
    waveCompleted: (save) => save.highestWaveCompleted
};

/** Current value of the stat a quest tracks. */
export function questValue(quest, save) {
    return STAT[quest.type] ? STAT[quest.type](save) : 0;
}

/**
 * Every quest with its live state: { ...quest, value, progress (0..1), done }.
 * `done` is true if the stat reached the target OR the quest was already recorded in save.completedTasks
 * (completion is permanent even if stats are ever reset).
 */
export function evaluateQuests(save) {
    const recorded = new Set(save.completedTasks);
    return QUESTS.map((q) => {
        const value = questValue(q, save);
        const done = recorded.has(q.id) || value >= q.target;
        return { ...q, value: Math.min(value, q.target), progress: done ? 1 : Math.min(1, value / q.target), done };
    });
}

/** Persist any newly reached quests into save.completedTasks. Returns the quests that were completed just now. */
export function syncQuests(save) {
    const recorded = save.completedTasks;
    const fresh = evaluateQuests(save).filter((q) => q.done && !recorded.includes(q.id));
    if (fresh.length) save.completedTasks = [...recorded, ...fresh.map((q) => q.id)];
    return fresh;
}

/** The first quest that is not done yet (for trackers), or null when everything is complete. */
export function nextQuest(save) {
    return evaluateQuests(save).find((q) => !q.done) ?? null;
}
