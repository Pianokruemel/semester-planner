import axios from "axios";
import { apiClient } from "./client";
import { CreateShareEnvelopeRequest, ShareEnvelope } from "./types";

export async function createShareEnvelope(payload: CreateShareEnvelopeRequest): Promise<ShareEnvelope> {
  const response = await apiClient.post<ShareEnvelope>("/shares", payload);
  return response.data;
}

export async function fetchShareEnvelope(locator: string): Promise<ShareEnvelope> {
  const response = await apiClient.get<ShareEnvelope>(`/shares/${encodeURIComponent(locator)}`);
  return response.data;
}

export function isShareLocatorConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

export function isShareOpenFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400);
}