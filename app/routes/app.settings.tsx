// app.routes/app.settings.tsx

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Button,
  Toast,
  Frame,
  BlockStack,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";

// For now this is in-memory; later you can persist in DB.
type Settings = {
  defaultSlaDays: string;
  enableNotifications: boolean;
  notifyOnInTransit: boolean;
  notifyOnOutForDelivery: boolean;
  notifyOnDelivered: boolean;
  defaultStatusForNewFulfillment: string;
};

// Fake store-level settings for demo
const DEFAULT_SETTINGS: Settings = {
  defaultSlaDays: "5",
  enableNotifications: false,
  notifyOnInTransit: true,
  notifyOnOutForDelivery: true,
  notifyOnDelivered: true,
  defaultStatusForNewFulfillment: "IN_TRANSIT",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // TODO: load from your DB keyed by shop
  const settings = DEFAULT_SETTINGS;

  return json<Settings>(settings);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  const settings: Settings = {
    defaultSlaDays: (formData.get("defaultSlaDays") as string) || "5",
    enableNotifications: formData.get("enableNotifications") === "on",
    notifyOnInTransit: formData.get("notifyOnInTransit") === "on",
    notifyOnOutForDelivery: formData.get("notifyOnOutForDelivery") === "on",
    notifyOnDelivered: formData.get("notifyOnDelivered") === "on",
    defaultStatusForNewFulfillment:
      (formData.get("defaultStatusForNewFulfillment") as string) || "IN_TRANSIT",
  };

  // TODO: persist `settings` to your DB here

  return json({ ok: true, settings });
};

export default function SettingsPage() {
  const initial = useLoaderData<Settings>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [defaultSlaDays, setDefaultSlaDays] = useState(initial.defaultSlaDays);
  const [enableNotifications, setEnableNotifications] = useState(
    initial.enableNotifications,
  );
  const [notifyOnInTransit, setNotifyOnInTransit] = useState(
    initial.notifyOnInTransit,
  );
  const [notifyOnOutForDelivery, setNotifyOnOutForDelivery] = useState(
    initial.notifyOnOutForDelivery,
  );
  const [notifyOnDelivered, setNotifyOnDelivered] = useState(
    initial.notifyOnDelivered,
  );
  const [defaultStatusForNewFulfillment, setDefaultStatusForNewFulfillment] =
    useState(initial.defaultStatusForNewFulfillment);

  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (actionData && (actionData as any).ok) {
      setShowToast(true);
    }
  }, [actionData]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("defaultSlaDays", defaultSlaDays);
    if (enableNotifications) formData.set("enableNotifications", "on");
    if (notifyOnInTransit) formData.set("notifyOnInTransit", "on");
    if (notifyOnOutForDelivery) formData.set("notifyOnOutForDelivery", "on");
    if (notifyOnDelivered) formData.set("notifyOnDelivered", "on");
    formData.set("defaultStatusForNewFulfillment", defaultStatusForNewFulfillment);

    submit(formData, { method: "POST" });
  };

  return (
    <Frame>
      <Page
        title="Delivery settings"
        subtitle="Configure how delivery statuses and notifications behave for this store."
        primaryAction={{ content: "Save", onAction: handleSubmit }}
      >
        <TitleBar title="Delivery settings" />
        {showToast && (
          <Toast
            content="Settings saved"
            onDismiss={() => setShowToast(false)}
          />
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
            <Card title="Service level & defaults" sectioned>
              <FormLayout>
                <TextField
                  label="Expected delivery window (days)"
                  type="number"
                  min={1}
                  value={defaultSlaDays}
                  onChange={setDefaultSlaDays}
                  helpText="Used to flag orders as delayed if not delivered within this many days."
                />

                <Select
                  label="Default delivery status for new fulfillments"
                  options={[
                    { label: "In transit", value: "IN_TRANSIT" },
                    { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
                    { label: "Delivered", value: "DELIVERED" },
                  ]}
                  value={defaultStatusForNewFulfillment}
                  onChange={setDefaultStatusForNewFulfillment}
                  helpText="This status is used when your app creates the first delivery event for a fulfillment."
                />
              </FormLayout>
            </Card>

            <Card title="Notifications" sectioned>
              <FormLayout>
                <Checkbox
                  label="Enable customer notifications"
                  checked={enableNotifications}
                  onChange={setEnableNotifications}
                  helpText="When enabled, your app can trigger WhatsApp, SMS, or email flows when delivery status changes."
                />

                {enableNotifications && (
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Notify when:
                      </Text>
                    </InlineStack>
                    <Checkbox
                      label="Order moves to In transit"
                      checked={notifyOnInTransit}
                      onChange={setNotifyOnInTransit}
                    />
                    <Checkbox
                      label="Order moves to Out for delivery"
                      checked={notifyOnOutForDelivery}
                      onChange={setNotifyOnOutForDelivery}
                    />
                    <Checkbox
                      label="Order is marked Delivered"
                      checked={notifyOnDelivered}
                      onChange={setNotifyOnDelivered}
                    />
                  </BlockStack>
                )}

                <InlineStack gap="300">
                  <Button primary onClick={handleSubmit}>
                    Save settings
                  </Button>
                </InlineStack>
              </FormLayout>
            </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card title="How settings are used" sectioned>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  • SLA days drive “delayed” flags in your Fulfillment Dashboard.
                </Text>
                <Text as="p" variant="bodyMd">
                  • Default status is applied when your app creates the first fulfillment event.
                </Text>
                <Text as="p" variant="bodyMd">
                  • Notification toggles control which events are allowed to fire outbound messages.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
