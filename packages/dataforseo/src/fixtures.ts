const envelope = <Result>(path: ReadonlyArray<string>, result: Result) => ({
  cost: 0.0101,
  status_code: 20_000,
  status_message: "Ok.",
  tasks: [
    {
      cost: 0.0101,
      data: { api: path[1], function: path.at(-2) },
      id: "10061200-1535-0216-0000-a1b2c3d4e5f6",
      path,
      result,
      result_count: 1,
      status_code: 20_000,
      status_message: "Ok.",
      time: "1.2345 sec.",
    },
  ],
  tasks_count: 1,
  tasks_error: 0,
  time: "1.3021 sec.",
  version: "0.1.20260915",
});

export const instantPagesResponse = envelope(
  ["v3", "on_page", "instant_pages"],
  [
    {
      crawl_progress: "finished",
      crawl_status: { max_crawl_pages: 1, pages_crawled: 1, pages_in_queue: 0 },
      items: [
        {
          broken_links: false,
          checks: {
            canonical: true,
            from_sitemap: false,
            has_render_blocking_resources: true,
            is_https: true,
            no_description: true,
            no_favicon: false,
            no_image_alt: true,
            seo_friendly_url: true,
            title_too_long: false,
          },
          meta: {
            content: { plain_text_rate: 0.12, plain_text_size: 5210, plain_text_word_count: 842 },
            description: null,
            external_links_count: 4,
            htags: { h1: ["Casamento na praia"], h2: ["Custos", "Fornecedores"] },
            images_count: 11,
            internal_links_count: 37,
            title: "Casamento na praia: guia completo",
          },
          onpage_score: 87.42,
          page_timing: {
            dom_complete: 1840,
            first_input_delay: 0,
            largest_contentful_paint: 1203,
            time_to_interactive: 1611,
          },
          resource_type: "html",
          status_code: 200,
          url: "https://casamento.example.com.br/praia/",
        },
      ],
      items_count: 1,
    },
  ],
);

export const domainRankOverviewResponse = envelope(
  ["v3", "dataforseo_labs", "google", "domain_rank_overview", "live"],
  [
    {
      items: [
        {
          language_code: "pt",
          location_code: 2076,
          metrics: {
            organic: {
              count: 1873,
              estimated_paid_traffic_cost: 912.55,
              etv: 2431.8,
              is_lost: 12,
              is_new: 40,
              pos_1: 14,
              pos_11_20: 301,
              pos_2_3: 52,
              pos_4_10: 188,
            },
            paid: { count: 0, etv: 0 },
          },
          se_type: "google",
        },
      ],
      items_count: 1,
      language_code: "pt",
      location_code: 2076,
      se_type: "google",
      target: "casamento.example.com.br",
      total_count: 1,
    },
  ],
);

export const rankedKeywordsResponse = envelope(
  ["v3", "dataforseo_labs", "google", "ranked_keywords", "live"],
  [
    {
      items: [
        {
          keyword_data: {
            keyword: "casamento na praia",
            keyword_info: {
              competition: 0.31,
              competition_level: "LOW",
              cpc: 1.42,
              search_volume: 6600,
            },
            language_code: "pt",
            location_code: 2076,
            se_type: "google",
          },
          ranked_serp_element: {
            check_url: "https://www.google.com.br/search?q=casamento%20na%20praia",
            keyword_difficulty: 18,
            serp_item: {
              domain: "casamento.example.com.br",
              rank_absolute: 3,
              rank_group: 2,
              type: "organic",
              url: "https://casamento.example.com.br/praia/",
            },
          },
          se_type: "google",
        },
        {
          keyword_data: {
            keyword: "vestido de noiva praia",
            keyword_info: { competition: null, cpc: null, search_volume: null },
          },
          ranked_serp_element: { serp_item: { rank_absolute: 14, type: "organic", url: null } },
          se_type: "google",
        },
      ],
      items_count: 2,
      target: "casamento.example.com.br",
      total_count: 1873,
    },
  ],
);

export const backlinksSummaryResponse = envelope(
  ["v3", "backlinks", "summary", "live"],
  [
    {
      backlinks: 3456,
      backlinks_spam_score: 7,
      broken_backlinks: 4,
      broken_pages: 2,
      crawled_pages: 310,
      first_seen: "2024-03-02 11:21:45 +00:00",
      rank: 212,
      referring_domains: 87,
      referring_domains_nofollow: 9,
      referring_main_domains: 80,
      referring_pages: 2988,
      target: "casamento.example.com.br",
    },
  ],
);

export const serpOrganicResponse = envelope(
  ["v3", "serp", "google", "organic", "live", "regular"],
  [
    {
      check_url: "https://www.google.com.br/search?q=casamento%20na%20praia&hl=pt",
      item_types: ["organic", "people_also_ask"],
      items: [
        {
          description: "Tudo sobre casamento na praia.",
          domain: "www.Concorrente.com.br",
          rank_absolute: 1,
          rank_group: 1,
          title: "Casamento na praia: 10 dicas",
          type: "organic",
          url: "https://www.concorrente.com.br/praia",
        },
        {
          items: [
            { title: "Quanto custa um casamento na praia?", type: "people_also_ask_element" },
          ],
          rank_absolute: 2,
          rank_group: 1,
          type: "people_also_ask",
        },
        {
          description: null,
          domain: "casamento.example.com.br",
          rank_absolute: 3,
          rank_group: 2,
          title: "Casamento na praia: guia completo",
          type: "organic",
          url: "https://casamento.example.com.br/praia/",
        },
        {
          domain: "sem-titulo.com.br",
          rank_absolute: 4,
          rank_group: 3,
          title: "",
          type: "organic",
          url: "https://sem-titulo.com.br/",
        },
      ],
      items_count: 4,
      keyword: "casamento na praia",
      language_code: "pt",
      location_code: 2076,
      se_domain: "google.com.br",
      type: "organic",
    },
  ],
);

export const taskErrorResponse = {
  cost: 0,
  status_code: 20_000,
  status_message: "Ok.",
  tasks: [
    {
      cost: 0,
      id: "10061200-1535-0216-0000-f6e5d4c3b2a1",
      result: null,
      result_count: 0,
      status_code: 40_501,
      status_message: "Invalid Field: 'location_code'.",
      time: "0 sec.",
    },
  ],
  tasks_count: 1,
  tasks_error: 1,
  time: "0.0501 sec.",
  version: "0.1.20260915",
};

export const insufficientFundsResponse = {
  cost: 0,
  status_code: 40_200,
  status_message: "Payment Required.",
  tasks: null,
  tasks_count: 0,
  tasks_error: 0,
  time: "0 sec.",
  version: "0.1.20260915",
};
