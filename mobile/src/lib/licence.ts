import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { colors } from "@/lib/theme";

/** Official UAE government page listing every licence-inquiry service. */
export const UAE_LICENCE_GUIDE_URL =
  "https://u.ae/en/information-and-services/business/important-digital-services/inquire-about-licences-names-and-activities";

/** National Economic Registry (Ministry of Economy & Tourism): UAE-wide licence search, all emirates and free zones. */
export const NATIONAL_ECONOMIC_REGISTRY_URL = "https://growth.gov.ae/G2C/InquiryAboutEconomicLicenses";

/** Federal Tax Authority home page; the "TRN Verification" box is in the header. */
export const FTA_TRN_URL = "https://tax.gov.ae/en/default.aspx";

export async function openOfficialSite(url: string): Promise<void> {
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url, {
    toolbarColor: colors.navy,
    controlsColor: colors.white,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

export async function copyIdentifier(value: string): Promise<void> {
  await Clipboard.setStringAsync(value);
}
