// Overlay scenes launched on top of MainMenu (registered in scenes/index.js).
import SettingsPanel from './SettingsPanel.js';
import QuestsPanel from './QuestsPanel.js';
import DifficultyPanel from './DifficultyPanel.js';
import BossGallery from './BossGallery.js';
import AchievementsPanel from './AchievementsPanel.js';
import RecordsPanel from './RecordsPanel.js';
import ControlsPanel from './ControlsPanel.js';

// ControlsPanel opens on top of SettingsPanel, so it must come after it (scenes draw in list order)
export const MENU_SCENES = [SettingsPanel, QuestsPanel, DifficultyPanel, BossGallery, AchievementsPanel, RecordsPanel, ControlsPanel];
