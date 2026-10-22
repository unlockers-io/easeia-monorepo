import { searchconsole, type searchconsole_v1 } from "@googleapis/searchconsole";
import { OAuth2Client, type Credentials } from "google-auth-library";

import { oauthClient } from "./oauth";

type SearchConsoleApi = {
  inspect: (
    body: searchconsole_v1.Schema$InspectUrlIndexRequest,
  ) => Promise<searchconsole_v1.Schema$InspectUrlIndexResponse>;
  listSites: () => Promise<searchconsole_v1.Schema$SitesListResponse>;
  query: (
    siteUrl: string,
    body: searchconsole_v1.Schema$SearchAnalyticsQueryRequest,
  ) => Promise<searchconsole_v1.Schema$SearchAnalyticsQueryResponse>;
};

type Google = {
  refreshAccessToken: (refreshToken: string) => Promise<Credentials>;
  searchConsole: (accessToken: string) => SearchConsoleApi;
};

const googleApis: Google = {
  refreshAccessToken: async (refreshToken) => {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();

    return credentials;
  },
  searchConsole: (accessToken) => {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const api = searchconsole({ auth, version: "v1" });

    return {
      inspect: async (requestBody) => {
        const { data } = await api.urlInspection.index.inspect({ requestBody });

        return data;
      },
      listSites: async () => {
        const { data } = await api.sites.list();

        return data;
      },
      query: async (siteUrl, requestBody) => {
        const { data } = await api.searchanalytics.query({ requestBody, siteUrl });

        return data;
      },
    };
  },
};

export { googleApis };

export type { Google, SearchConsoleApi };
