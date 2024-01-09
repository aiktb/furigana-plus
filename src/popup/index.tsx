import '~/assets/style.css';

import { Transition } from '@headlessui/react';
import { Suspense, use, useReducer } from 'react';
import Browser from 'webextension-polyfill';

import { Storage } from '@plasmohq/storage';

import {
  ExtensionEvent,
  ExtensionStorage,
  FuriganaType,
  SelectMode,
  toStorageKey,
  type Config,
} from '~contents/core';

import ColorPickerIcon from 'react:~/assets/icons/ColorPicker.svg';
import CursorOutlineIcon from 'react:~/assets/icons/CursorOutline.svg';
import CursorTextIcon from 'react:~/assets/icons/CursorText.svg';
import EyeIcon from 'react:~/assets/icons/Eye.svg';
import EyeOffIcon from 'react:~/assets/icons/EyeOff.svg';
import FontSizeIcon from 'react:~/assets/icons/FontSize.svg';
import GithubIcon from 'react:~/assets/icons/Github.svg';
import HiraganaIcon from 'react:~/assets/icons/Hiragana.svg';
import Logo from 'react:~/assets/icons/Logo.svg';
import PowerIcon from 'react:~/assets/icons/Power.svg';
import SettingIcon from 'react:~/assets/icons/Setting.svg';

import Button from './components/Button';
import CheckBox from './components/CheckBox';
import ColorPicker from './components/ColorPicker';
import Link from './components/Link';
import MenuItem from './components/MenuItem';
import RangeSlider from './components/RangeSlider';
import Select from './components/Select';

const initializeConfig = async () => {
  const storage = new Storage({ area: 'local' });
  return {
    display: await storage.get(ExtensionStorage.Display),
    hoverMode: await storage.get(ExtensionStorage.HoverMode),
    furiganaType: await storage.get(ExtensionStorage.FuriganaType),
    selectMode: await storage.get(ExtensionStorage.SelectMode),
    fontSize: await storage.get(ExtensionStorage.FontSize),
    fontColor: await storage.get(ExtensionStorage.FontColor),
  } as Config;
};

export default function Popup() {
  if (
    localStorage.theme === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return (
    <Suspense fallback={<Logo width="192" height="192" />}>
      <Transition
        appear
        show={true}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Menu configPromise={initializeConfig()} />
      </Transition>
    </Suspense>
  );
}

async function addFurigana() {
  // `chrome.tabs.query` is not compatible with firefox.
  const tabId = (await Browser.tabs.query({ active: true, currentWindow: true })).at(0)!.id!;
  await Browser.tabs.sendMessage(tabId, ExtensionEvent.AddFurigana);
}

type ACTIONTYPE =
  | { type: ExtensionEvent.ToggleDisplay; payload: boolean }
  | { type: ExtensionEvent.ToggleHoverMode; payload: boolean }
  | { type: ExtensionEvent.SwitchFuriganaType; payload: FuriganaType }
  | { type: ExtensionEvent.SwitchSelectMode; payload: SelectMode }
  | { type: ExtensionEvent.AdjustFontSize; payload: number }
  | { type: ExtensionEvent.AdjustFontColor; payload: string };

function reducer(state: Config, action: ACTIONTYPE) {
  async function sendMessage() {
    /* There are many pages that cannot inject content scripts, such as "newtab" and "chromewebstore.google.com",
    and using `chrome.tabs.sendMessage` on these pages throws the following Error:
    error.message: "Could not establish connection. Receiving end does not exist." */
    /* Refactor Note: Move the `storage.set` logic to the content script. */
    const storage = new Storage({ area: 'local' });
    await storage.set(toStorageKey(action.type), action.payload);
    const tabs = await Browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]!.id!;
    await Browser.tabs.sendMessage(tabId, action.type);
  }
  sendMessage();

  switch (action.type) {
    case ExtensionEvent.ToggleDisplay:
      return { ...state, display: action.payload };
    case ExtensionEvent.ToggleHoverMode:
      return { ...state, hoverMode: action.payload };
    case ExtensionEvent.SwitchFuriganaType:
      return { ...state, furiganaType: action.payload };
    case ExtensionEvent.SwitchSelectMode:
      return { ...state, selectMode: action.payload };
    case ExtensionEvent.AdjustFontSize:
      return { ...state, fontSize: action.payload };
    case ExtensionEvent.AdjustFontColor:
      return { ...state, fontColor: action.payload };
  }
}

function Menu({ configPromise }: { configPromise: Promise<Config> }) {
  const [state, dispatch] = useReducer(reducer, use(configPromise));

  return (
    <menu className="space-y-1.5 border-r-2 border-primary pr-2">
      <MenuItem icon={<CursorOutlineIcon />} tip="Press ESC to cancel">
        <Button text="Add furigana" onClick={addFurigana} />
      </MenuItem>
      <MenuItem icon={<PowerIcon className={state.display ? 'text-primary' : ''} />}>
        <CheckBox
          text="On-off extension"
          checked={state.display}
          onChange={(checked) => {
            dispatch({ type: ExtensionEvent.ToggleDisplay, payload: checked });
          }}
        />
      </MenuItem>
      <MenuItem icon={state.hoverMode ? <EyeIcon className="text-primary" /> : <EyeOffIcon />}>
        <CheckBox
          text="Hover mode"
          checked={state.hoverMode}
          onChange={(checked) => {
            dispatch({ type: ExtensionEvent.ToggleHoverMode, payload: checked });
          }}
        />
      </MenuItem>
      <MenuItem icon={<HiraganaIcon />}>
        <Select
          label="Switch furigana type"
          selected={state.furiganaType}
          options={[FuriganaType.Hiragana, FuriganaType.Katakana, FuriganaType.Romaji]}
          onChange={(selected) => {
            dispatch({
              type: ExtensionEvent.SwitchFuriganaType,
              payload: selected as FuriganaType,
            });
          }}
        />
      </MenuItem>
      <MenuItem icon={<CursorTextIcon />}>
        <Select
          label="Switch select mode"
          selected={state.selectMode}
          options={[SelectMode.Original, SelectMode.Furigana]}
          onChange={(selected) => {
            dispatch({
              type: ExtensionEvent.SwitchSelectMode,
              payload: selected as SelectMode,
            });
          }}
        />
      </MenuItem>
      <MenuItem icon={<FontSizeIcon />}>
        <RangeSlider
          value={state.fontSize}
          min={50}
          max={100}
          step={1}
          onChange={(value) => {
            dispatch({ type: ExtensionEvent.AdjustFontSize, payload: value });
          }}
        />
      </MenuItem>
      <MenuItem icon={<ColorPickerIcon />}>
        <ColorPicker
          color={state.fontColor}
          onChange={(color) => {
            dispatch({ type: ExtensionEvent.AdjustFontColor, payload: color });
          }}
        />
      </MenuItem>
      <MenuItem icon={<SettingIcon />} tip="Open the options page">
        <Link href="options.html" text="Edit rules" />
      </MenuItem>
      <MenuItem icon={<GithubIcon />} tip="Open an issue on GitHub">
        <Link href="https://github.com/aiktb/FuriganaMaker/issues" text="Feedback" />
      </MenuItem>
    </menu>
  );
}