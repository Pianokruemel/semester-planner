export type AppointmentType = "Vorlesung" | "Uebung";

export type Category = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  courseId: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  room: string;
  type: AppointmentType;
  createdAt: string;
};

export type Course = {
  id: string;
  name: string;
  abbreviation: string;
  cp: number;
  categoryId: string | null;
  isActive: boolean;
  createdAt: string;
  category: Category | null;
  appointments: Appointment[];
};

export type Settings = {
  dark_mode: boolean;
  show_full_name: boolean;
  active_filters: {
    cp: number[];
    hideTypes: AppointmentType[];
    showRoom: boolean;
    showType: boolean;
    showTime: boolean;
    showTotalCp: boolean;
  };
};

export const defaultSettings: Settings = {
  dark_mode: false,
  show_full_name: false,
  active_filters: {
    cp: [],
    hideTypes: [],
    showRoom: true,
    showType: true,
    showTime: true,
    showTotalCp: true
  }
};
