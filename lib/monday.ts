const MONDAY_API_URL = "https://api.monday.com/v2";

async function mondayQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    throw new Error("MONDAY_API_KEY environment variable is not set");
  }

  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Monday API request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Monday API error: ${json.errors[0].message}`);
  }

  return json.data as T;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: { id: string; text: string; value: string | null }[];
}

interface FetchItemsResponse {
  boards: { items_page: { items: MondayItem[] } }[];
}

export async function fetchPendingSignals(boardId: string): Promise<MondayItem[]> {
  const query = `
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        items_page(query_params: { rules: [{ column_id: "status", compare_value: ["Pending"] }] }) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  const data = await mondayQuery<FetchItemsResponse>(query, { boardId: [boardId] });
  return data.boards[0]?.items_page.items ?? [];
}

export async function updateSignalStatus(
  itemId: string,
  status: "Confirmed" | "Dismissed"
): Promise<void> {
  const query = `
    mutation ($itemId: ID!, $value: JSON!) {
      change_simple_column_value(item_id: $itemId, board_id: 0, column_id: "status", value: $value) {
        id
      }
    }
  `;

  await mondayQuery(query, {
    itemId,
    value: JSON.stringify({ label: status }),
  });
}
