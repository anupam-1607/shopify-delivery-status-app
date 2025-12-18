import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { Page, Card, IndexTable, Badge, Select, Text, Toast, Frame } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getOrders {
      orders(first: 50, reverse: true) {
        edges {
          node {
            id
            name
            displayFulfillmentStatus
            fulfillments(first: 5) {
              id
              status
              events(first: 10, reverse: true) {
                edges {
                  node { status }
                }
              }
            }
          }
        }
      }
    }`
  );

  const data = await response.json();
  return json({ orders: data.data?.orders?.edges || [] });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const fulfillmentId = formData.get("fulfillmentId") as string;
  const status = formData.get("status") as string;

  const response = await admin.graphql(
    `#graphql
    mutation fulfillmentEventCreate($fulfillmentEvent: FulfillmentEventInput!) {
      fulfillmentEventCreate(fulfillmentEvent: $fulfillmentEvent) {
        fulfillmentEvent { id status }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        fulfillmentEvent: { fulfillmentId, status: status.toUpperCase() },
      },
    }
  );

  const resJson = await response.json();
  const userErrors = resJson.data?.fulfillmentEventCreate?.userErrors || [];

  if (userErrors.length === 0) {
    return redirect("/app/orders");
  }

  return json({ errors: userErrors }, { status: 400 });
};

export default function OrdersPage() {
  const { orders } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (actionData) setShowToast(true);
  }, [actionData]);

  const hasErrors = !!actionData && "errors" in actionData && actionData.errors?.length > 0;

  return (
    <Frame>
      <Page title="Fulfillment Dashboard">
        {showToast && hasErrors && (
          <Toast
            content={actionData?.errors?.[0]?.message || "Update failed"}
            error
            onDismiss={() => setShowToast(false)}
          />
        )}
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "order", plural: "orders" }}
            itemCount={orders.length}
            headings={[
              { title: "Order" },
              { title: "Fulfillment" },
              { title: "Delivery Action" },
            ]}
            selectable={false}
          >
            {orders.map(({ node }: any, index: number) => {
              const firstFulfillment = node.fulfillments?.[0];
              const fulfillmentId = firstFulfillment?.id || null;

              const edges = firstFulfillment?.events?.edges || [];
              const latestEvent = edges[0]; // newest because of reverse: true
              const currentStatus = latestEvent?.node?.status?.toLowerCase() || "label";

              const hasFulfillment = Boolean(fulfillmentId);

              return (
                <IndexTable.Row id={node.id} key={node.id} position={index}>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold" as="span">
                      {node.name}
                    </Text>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Badge>
                      {node.displayFulfillmentStatus ||
                        (hasFulfillment ? "FULFILLED" : "NO FULFILLMENT")}
                    </Badge>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Select
                      label="Delivery Action"
                      labelHidden
                      options={[
                        { label: "Update Status...", value: "label", disabled: true },
                        { label: "In Transit", value: "in_transit" },
                        { label: "Out for Delivery", value: "out_for_delivery" },
                        { label: "Delivered", value: "delivered" },
                      ]}
                      value={currentStatus}
                      onChange={(val) =>
                        submit(
                          { status: val, fulfillmentId: fulfillmentId ?? "" },
                          { method: "POST" }
                        )
                      }
                      disabled={!hasFulfillment}
                    />
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        </Card>
      </Page>
    </Frame>
  );
}
