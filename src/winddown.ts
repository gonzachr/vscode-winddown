import { ExtensionContext, WorkspaceConfiguration, StatusBarItem, window, StatusBarAlignment } from 'vscode'
import * as editor from './editor'

export interface WinddownConfiguration extends WorkspaceConfiguration {
  framesPerMinute: number;
  minutesTillBreak: number;
  breakDurationMinutes: number;
  winddownDurationMinutes: number;
  postponeDurationMinutes: number;
}

export default class Winddown {
  public static readonly extensionName = 'Winddown'
  public static readonly extensionAlias = 'winddown'
  public static extensionContext: ExtensionContext

  private config = {
    framesPerMinute: 4,
    minutesTillBreak: 25,
    breakDurationMinutes: 3,
    winddownDurationMinutes: 5,
    postponeDurationMinutes: 5,
  } as WinddownConfiguration;
  private firstActive: number // end of last break
  private lastActive: number // last activity
  private currentSaturation = 1.0
  private timer!: NodeJS.Timer
  private statusBarItem!: StatusBarItem;

  constructor() {
    this.firstActive = Date.now();
    this.lastActive = Date.now();
  }

  private reset() {
    editor.reset();
    this.currentSaturation = 1.0
    if (this.statusBarItem) {
      this.statusBarItem.hide();
    }
  }

  public start() {
    const framesPerMinute = Math.min(60, Math.max(1, this.config.framesPerMinute));
    this.timer = setInterval(() => {
      this.update()
    }, 1000 * 60 / framesPerMinute);
    this.reset();
  }

  public stop() {
    this.reset()
    clearInterval(this.timer)
  }

  public configure(config: WinddownConfiguration) {
    this.config = config;
    this.update();
  }

  /**
   * Postpone the break.
   */
  public postpone() {
    this.firstActive = Date.now() - (this.config.minutesTillBreak - this.config.postponeDurationMinutes) * 1000 * 60
    this.reset()
  }

  /**
   * Register user activity.
   */
  public logActivity() {
    this.lastActive = Date.now()
  }

  /**
   * Re-render the UI.
   */
  public update() {
    const now = Date.now()
    const minutesSinceLastActive = (now - this.lastActive) / 1000 / 60
    const minutesSinceFirstActive = (now - this.firstActive) / 1000 / 60

    if (minutesSinceLastActive > this.config.breakDurationMinutes) {
      // on a break
      this.firstActive = Date.now();
      this.reset()
    } else {
      // still coding
      if (minutesSinceFirstActive > this.config.minutesTillBreak) {
        // needs a break
        const overtimeMinutes = minutesSinceFirstActive - this.config.minutesTillBreak;
        const overtimeFraction = overtimeMinutes / this.config.winddownDurationMinutes;
        const newSaturation = 1 - overtimeFraction

        // avoid refreshes that do not change colors perceivably
        if (Math.abs(this.currentSaturation - newSaturation) > 0.01) {
          this.currentSaturation = newSaturation
          editor.setSaturation(1 - overtimeFraction);
        }

        if (!this.statusBarItem) {
          this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
          this.statusBarItem.command = 'winddown.postpone'
        }
        this.statusBarItem.text = 'You should take a break! (Click for ' + this.config.postponeDurationMinutes + ' more minutes)';
        this.statusBarItem.show();
      }
    }
  }
}
