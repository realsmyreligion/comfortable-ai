const {normalizeForeignStock} = require('./marketCore');

const YATA_EXPORT_URL =
  'https://yata.yt/api/v1/travel/export/';

const TORN_ITEMS_URL =
  'https://api.torn.com/v2/torn/items?cat=All&sort=ASC&comment=TornPulseMkt';

async function fetchJson(
  url,
  options = {},
  timeoutMs = 15000
) {
  const controller =
    typeof AbortController !== 'undefined'
      ? new AbortController()
      : null;

  const timer = controller
    ? setTimeout(
        () => controller.abort(),
        timeoutMs
      )
    : null;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller
        ? controller.signal
        : undefined
    });

    if (!response.ok) {
      throw new Error(
        `Request failed (${response.status})`
      );
    }

    const data = await response.json();

    if (data && data.error) {
      const message =
        data.error.error ||
        data.error.message ||
        JSON.stringify(data.error);

      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (
      String(error?.name) ===
      'AbortError'
    ) {
      throw new Error(
        'Request timed out'
      );
    }

    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function fetchForeignStock() {
  const payload = await fetchJson(
    YATA_EXPORT_URL,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  const rows =
    normalizeForeignStock(payload);

  if (!rows.length) {
    throw new Error(
      'Foreign stock feed returned no usable stock data.'
    );
  }

  return {
    rows,
    fetchedAt: Date.now()
  };
}

function extractItems(payload) {
  if (
    Array.isArray(
      payload?.items
    )
  ) {
    return payload.items;
  }

  if (
    payload?.items &&
    typeof payload.items === 'object'
  ) {
    return Object.entries(
      payload.items
    ).map(
      ([id, item]) => ({
        id: Number(
          item?.id || id
        ),
        ...(item || {})
      })
    );
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

export async function fetchTornItemPrices(
  apiKey
) {
  const key =
    String(apiKey || '').trim();

  if (!key) {
    throw new Error(
      'Add a Torn API key in Settings to sync market values.'
    );
  }

  const url =
    `${TORN_ITEMS_URL}&key=` +
    encodeURIComponent(key);

  const payload = await fetchJson(
    url,
    {
      headers: {
        Accept: 'application/json'
      }
    },
    20000
  );

  const items =
    extractItems(payload);

  if (!items.length) {
    throw new Error(
      'Torn items API returned no item data.'
    );
  }

  const map = {};

  for (const item of items) {
    const id =
      Number(item?.id);

    if (!Number.isFinite(id)) {
      continue;
    }

    const value =
      item?.value || {};

    const marketPrice = Number(
      value.market_price ??
      item.market_price ??
      item.market_value ??
      0
    );

    map[String(id)] = {
      id,
      name: String(
        item.name ||
        `Item #${id}`
      ),
      marketPrice:
        Number.isFinite(
          marketPrice
        )
          ? marketPrice
          : 0
    };
  }

  return {
    map,
    fetchedAt: Date.now(),
    count:
      Object.keys(map).length
  };
}
