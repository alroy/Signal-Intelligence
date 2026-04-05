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

// Column ID for the Status column on the Signal Intelligence board (board 18407235431)
const STATUS_COLUMN_ID = "color_mm23b9pc";

export async function fetchPendingSignals(boardId: string): Promise<MondayItem[]> {
  const query = `
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        items_page(query_params: { rules: [{ column_id: "${STATUS_COLUMN_ID}", compare_value: ["Pending"] }] }) {
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
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    throw new Error("MONDAY_BOARD_ID environment variable is not set");
  }

  const query = `
    mutation ($itemId: ID!, $boardId: ID!, $value: JSON!) {
      change_simple_column_value(item_id: $itemId, board_id: $boardId, column_id: "${STATUS_COLUMN_ID}", value: $value) {
        id
      }
    }
  `;

  await mondayQuery(query, {
    itemId,
    boardId,
    value: JSON.stringify({ label: status }),
  });
}

export async function createBoardItem(
  boardId: string,
  itemName: string,
  columnValues: Record<string, unknown>
): Promise<string> {
  const query = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }
  `;

  const data = await mondayQuery<{ create_item: { id: string } }>(query, {
    boardId,
    itemName,
    columnValues: JSON.stringify(columnValues),
  });

  return data.create_item.id;
}
