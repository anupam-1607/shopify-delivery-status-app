import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link as RemixLink } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  InlineStack,
  Button,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

type LoaderData = {
  todayCount: number;
  inTransitCount: number;
  outForDeliveryCount: number;
  deliveredCount: number;
  attentionOrders: {
    id: string;
    name: string;
    displayFulfillmentStatus: string | null;
    latestEventStatus: string | null;
  }[];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query dashboardSummary {
      orders(first: 50, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            displayFulfillmentStatus
            fulfillments(first: 5) {
              id
              events(first: 10, reverse: true) {
                edges {
                  node { status createdAt }
                }
              }
            }
          }
        }
      }
    }`
  );

  const data = await response.json();
  const edges: any[] = data.data?.orders?.edges || [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  let todayCount = 0;
  let inTransitCount = 0;
  let outForDeliveryCount = 0;
  let deliveredCount = 0;
  const attentionOrders: LoaderData["attentionOrders"] = [];

  edges.forEach(({ node }) => {
    const processedDate = node.processedAt?.slice(0, 10);
    if (processedDate === todayStr) todayCount += 1;

    const firstFulfillment = node.fulfillments?.[0];
    const latestEvent = firstFulfillment?.events?.edges?.[0]?.node || null;
    const status: string | null = latestEvent?.status || null;

    switch (status) {
      case "IN_TRANSIT":
        inTransitCount += 1;
        break;
      case "OUT_FOR_DELIVERY":
        outForDeliveryCount += 1;
        break;
      case "DELIVERED":
        deliveredCount += 1;
        break;
    }

    // Needs attention: in transit / out for delivery / failed delivery
    if (
      status === "IN_TRANSIT" ||
      status === "OUT_FOR_DELIVERY" ||
      status === "ATTEMPTED_DELIVERY"
    ) {
      attentionOrders.push({
        id: node.id,
        name: node.name,
        displayFulfillmentStatus: node.displayFulfillmentStatus,
        latestEventStatus: status,
      });
    }
  });

  return json<LoaderData>({
    todayCount,
    inTransitCount,
    outForDeliveryCount,
    deliveredCount,
    attentionOrders: attentionOrders.slice(0, 10),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const {
    todayCount,
    inTransitCount,
    outForDeliveryCount,
    deliveredCount,
    attentionOrders,
  } = useLoaderData<LoaderData>();

  return (
    <Page>
      <TitleBar
        title="Delivery Status"
        primaryAction={{
          content: "View all orders",
          url: "/app/orders",
        }}
      />
      <BlockStack gap="500">
        <Layout>
          {/* Metrics column */}
          <Layout.Section>
            <BlockStack gap="400">
              <Card sectioned>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingLg">
                    Delivery overview
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Track how today’s orders are moving through your delivery pipeline.
                  </Text>
                  <InlineStack gap="400" wrap>
                    <Box padding="300" background="bg-surface-subdued" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="p">
                          {todayCount}
                        </Text>
                        <Text as="p" tone="subdued">
                          Orders today
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box padding="300" background="bg-surface-subdued" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="p">
                          {inTransitCount}
                        </Text>
                        <Text as="p" tone="subdued">
                          In transit
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box padding="300" background="bg-surface-subdued" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="p">
                          {outForDeliveryCount}
                        </Text>
                        <Text as="p" tone="subdued">
                          Out for delivery
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box padding="300" background="bg-surface-subdued" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="p">
                          {deliveredCount}
                        </Text>
                        <Text as="p" tone="subdued">
                          Delivered
                        </Text>
                      </BlockStack>
                    </Box>
                  </InlineStack>
                  <InlineStack gap="300">
                    <Button primary url="/app/orders">
                      Open fulfillment dashboard
                    </Button>
                    <Button url="/app/settings" variant="secondary">
                      Delivery settings
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <Box padding="400">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Needs attention
                      </Text>
                      <Button
                        plain
                        url="/app/orders"
                        accessibilityLabel="View all orders"
                      >
                        View all
                      </Button>
                    </InlineStack>

                    {attentionOrders.length === 0 ? (
                      <Text as="p" tone="subdued">
                        No deliveries require attention right now.
                      </Text>
                    ) : (
                      <BlockStack gap="200">
                        {attentionOrders.map((order) => (
                          <InlineStack
                            key={order.id}
                            align="space-between"
                            blockAlign="center"
                          >
                            <BlockStack gap="100">
                              <RemixLink to="/app/orders">
                                <Text as="span" variant="bodyMd" fontWeight="bold">
                                  {order.name}
                                </Text>
                              </RemixLink>
                              <Text as="span" tone="subdued">
                                Fulfillment: {order.displayFulfillmentStatus || "Unknown"}
                              </Text>
                            </BlockStack>
                            <Badge>
                              {order.latestEventStatus || "Pending"}
                            </Badge>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Box>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Right column */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card sectioned>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    How to use this app
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Use the Fulfillment Dashboard to update delivery status for each order and keep Shopify’s Delivery status in sync.
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd">
                      • Open <RemixLink to="/app/orders">Fulfillment Dashboard</RemixLink>.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      • Choose a delivery action (In transit, Out for delivery, Delivered).
                    </Text>
                    <Text as="p" variant="bodyMd">
                      • Changes appear instantly in Shopify order timelines.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card sectioned>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Coming next
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Planned improvements for your delivery workflow:
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd">
                      • Customer tracking page with live status.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      • WhatsApp / SMS notifications for key events.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      • Carrier performance and delivery SLA reports.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
