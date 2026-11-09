/**
 * Minimal ambient types for the Foundry VTT v14 globals this addon uses.
 * @league-of-foundry-developers/foundry-vtt-types only covers v13 and is
 * still beta (see plan risk note) — kept deliberately small and hand-written
 * instead of pulling in a mismatched dependency.
 */
export {};

declare global {
  interface GameSettingsConfig<T = unknown> {
    name?: string;
    hint?: string;
    scope: 'world' | 'client';
    config: boolean;
    type: unknown;
    default: T;
    requiresReload?: boolean;
    onChange?: (value: T) => void;
  }

  interface GameSettingsMenuConfig {
    name: string;
    label: string;
    hint?: string;
    icon?: string;
    type: unknown;
    restricted?: boolean;
  }

  interface GameSettings {
    register<T = unknown>(namespace: string, key: string, data: GameSettingsConfig<T>): void;
    get<T = unknown>(namespace: string, key: string): T;
    set<T = unknown>(namespace: string, key: string, value: T): Promise<T>;
    registerMenu(namespace: string, key: string, data: GameSettingsMenuConfig): void;
  }

  interface GameI18n {
    lang: string;
    localize(key: string): string;
    format(key: string, data?: Record<string, unknown>): string;
  }

  interface GameUser {
    id: string;
    isGM: boolean;
    name: string;
  }

  interface GameWorld {
    id: string;
    title: string;
  }

  interface KeybindingActionConfig {
    name?: string;
    editable?: { key: string; modifiers?: string[] }[];
    onDown?: () => boolean | void;
    onUp?: () => boolean | void;
    restricted?: boolean;
    precedence?: number;
  }

  interface GameKeybindings {
    register(namespace: string, action: string, data: KeybindingActionConfig): void;
  }

  /**
   * Structural minimum for any linkable Foundry document (Scene, Actor,
   * JournalEntry, Item, TokenDocument, Tile) — P5's link-store.ts only ever
   * needs getFlag/setFlag/id/name, never the full Document API.
   */
  interface FoundryDocumentLike {
    id: string;
    name: string;
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  }

  interface GameScenesCollection {
    get(id: string): FoundryDocumentLike | undefined;
  }

  /**
   * Foundry's own peer-to-peer relay (module.json's `socket: true`) —
   * distinct from the addon's managed Socket.IO connection to the Atlas
   * backend (`socket/atlas-socket.ts`). Used only for the P8 GM-broadcast
   * "suggest-open" hint, which never carries Atlas content, only ids.
   */
  interface GameSocket {
    emit(event: string, data: unknown): void;
    on(event: string, callback: (data: unknown) => void): void;
  }

  interface Game {
    settings: GameSettings;
    i18n: GameI18n;
    user: GameUser;
    world: GameWorld;
    keybindings: GameKeybindings;
    scenes: GameScenesCollection;
    socket: GameSocket;
  }

  var game: Game;

  interface TokenPlaceable {
    id: string;
    document: FoundryDocumentLike;
    actor: FoundryDocumentLike | null;
  }

  interface CanvasTokensLayer {
    placeables: TokenPlaceable[];
    controlled: TokenPlaceable[];
  }

  interface FoundryCanvas {
    ready: boolean;
    scene: FoundryDocumentLike | null;
    tokens: CanvasTokensLayer;
  }

  var canvas: FoundryCanvas;

  interface UiNotificationOptions {
    permanent?: boolean;
    console?: boolean;
  }

  interface UiNotifications {
    info(message: string, options?: UiNotificationOptions): void;
    warn(message: string, options?: UiNotificationOptions): void;
    error(message: string, options?: UiNotificationOptions): void;
  }

  interface Ui {
    notifications: UiNotifications;
    /** Registry of every currently-rendered Application (v1 back-compat layer, still populated in v14) — DocumentSheet instances expose `.document`. */
    windows?: Record<string, unknown>;
  }

  var ui: Ui;

  // Hook argument shapes differ per hook name (Foundry doesn't type this
  // itself either) — `any[]` here, not `unknown[]`, so call sites can type
  // their own callback parameters narrowly instead of widening to `unknown`.
  type HookCallback = (...args: any[]) => unknown;

  interface HooksStatic {
    on(hook: string, callback: HookCallback): number;
    once(hook: string, callback: HookCallback): number;
    off(hook: string, callback: HookCallback): void;
    callAll(hook: string, ...args: any[]): boolean;
  }

  var Hooks: HooksStatic;

  namespace foundry {
    namespace applications {
      namespace api {
        interface ApplicationV2WindowOptions {
          title?: string;
          icon?: string;
          resizable?: boolean;
        }

        interface ApplicationV2PositionOptions {
          top?: number;
          left?: number;
          width?: number;
          height?: number;
        }

        interface ApplicationV2Options {
          id?: string;
          classes?: string[];
          window?: ApplicationV2WindowOptions;
          position?: ApplicationV2PositionOptions;
          /** `'form'` makes the application element itself a `<form>`; `form.handler` receives its submit. */
          tag?: string;
          form?: {
            handler?: (event: Event, form: HTMLFormElement, formData: { object: Record<string, unknown> }) => void | Promise<void>;
            closeOnSubmit?: boolean;
          };
        }

        class ApplicationV2 {
          static DEFAULT_OPTIONS: ApplicationV2Options;
          constructor(options?: ApplicationV2Options);
          /** Reactive after first render — `{top,left,width,height}` in pixels (plus a `scale` Foundry itself ignores here). */
          position: ApplicationV2PositionOptions;
          render(force?: boolean): Promise<this>;
          close(options?: Record<string, unknown>): Promise<this>;
          bringToFront(): void;
          protected _renderHTML(context?: unknown, options?: unknown): Promise<HTMLElement>;
          protected _replaceHTML(result: HTMLElement, content: HTMLElement, options?: unknown): Promise<void>;
          protected _onClose(options?: Record<string, unknown>): void;
        }

        interface DialogV2FormButton {
          form: HTMLFormElement;
        }

        interface DialogV2Button {
          label: string;
          action?: string;
          default?: boolean;
          callback?: (
            event: Event,
            button: HTMLButtonElement & DialogV2FormButton,
            dialog: DialogV2RenderContext,
          ) => void | Promise<void>;
        }

        interface DialogV2RenderContext {
          element: HTMLElement;
          close(options?: Record<string, unknown>): Promise<void>;
        }

        interface DialogV2PromptOptions {
          window?: { title?: string };
          content: string;
          ok?: DialogV2Button;
          buttons?: DialogV2Button[];
          render?: (event: Event, dialog: DialogV2RenderContext) => void;
        }

        class DialogV2 {
          static prompt(options: DialogV2PromptOptions): Promise<unknown>;
        }
      }

      namespace ux {
        interface TextEditorImplementation {
          enrichHTML(content: string, options?: Record<string, unknown>): Promise<string>;
        }

        interface TextEditorStatic {
          implementation: TextEditorImplementation;
        }

        const TextEditor: TextEditorStatic;
      }
    }

    namespace utils {
      function escapeHTML(value: string): string;
      function randomID(length?: number): string;
    }
  }
}
