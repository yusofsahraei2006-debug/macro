// The Add tab never shows a screen of its own: the tab bar's central button opens the /add sheet.
import { Redirect } from 'expo-router';

export default function AddTab() {
  return <Redirect href="/" />;
}
