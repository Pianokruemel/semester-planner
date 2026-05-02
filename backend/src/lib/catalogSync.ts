import { CatalogAppointment } from "@prisma/client";
import { createHash } from "crypto";
import { ymdFromDate } from "./dates";

export type AppointmentLike = {
  date: Date;
  timeFrom: string;
  timeTo: string;
  room: string;
  type: string;
};

function normalizedAppointments(appointments: AppointmentLike[]) {
  return appointments
    .map((appointment) => ({
      date: ymdFromDate(appointment.date),
      timeFrom: appointment.timeFrom,
      timeTo: appointment.timeTo,
      room: appointment.room,
      type: appointment.type
    }))
    .sort((left, right) => {
      return (
        left.date.localeCompare(right.date) ||
        left.timeFrom.localeCompare(right.timeFrom) ||
        left.timeTo.localeCompare(right.timeTo) ||
        left.room.localeCompare(right.room) ||
        left.type.localeCompare(right.type)
      );
    });
}

export function appointmentFingerprint(appointments: AppointmentLike[]) {
  return createHash("sha256").update(JSON.stringify(normalizedAppointments(appointments))).digest("hex");
}

export function appointmentTimePlaceKey(appointment: Pick<AppointmentLike, "date" | "timeFrom" | "timeTo" | "room">) {
  return [ymdFromDate(appointment.date), appointment.timeFrom, appointment.timeTo, appointment.room].join("|");
}

export function plannedAppointmentsFromCatalog(appointments: CatalogAppointment[]) {
  return appointments
    .slice()
    .sort((left, right) => left.position - right.position || left.date.getTime() - right.date.getTime())
    .map((appointment, index) => ({
      date: appointment.date,
      timeFrom: appointment.timeFrom,
      timeTo: appointment.timeTo,
      room: appointment.room,
      type: appointment.type,
      position: index
    }));
}
