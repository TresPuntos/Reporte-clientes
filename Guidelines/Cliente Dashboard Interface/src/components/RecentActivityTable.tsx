import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { ArrowRight } from "lucide-react";

interface Activity {
  id: string;
  task: string;
  date: string;
  project: string;
  responsible: string;
  hours: number;
}

// Datos de ejemplo: múltiples tareas pueden tener la misma descripción
const activities: Activity[] = [
  {
    id: "1",
    task: "Diseño de wireframes",
    date: "26 Oct 2025",
    project: "Rediseño web corporativo",
    responsible: "María García",
    hours: 4.5,
  },
  {
    id: "2",
    task: "Implementación de componentes",
    date: "24 Oct 2025",
    project: "App móvil cliente",
    responsible: "Carlos Ruiz",
    hours: 6.0,
  },
  {
    id: "3",
    task: "Reuniones de seguimiento",
    date: "23 Oct 2025",
    project: "Rediseño web corporativo",
    responsible: "Ana López",
    hours: 1.5,
  },
  {
    id: "4",
    task: "Testing y ajustes",
    date: "22 Oct 2025",
    project: "App móvil cliente",
    responsible: "Carlos Ruiz",
    hours: 3.0,
  },
  {
    id: "5",
    task: "Documentación técnica",
    date: "20 Oct 2025",
    project: "Sistema de gestión interno",
    responsible: "María García",
    hours: 2.0,
  },
  {
    id: "6",
    task: "Diseño de wireframes",
    date: "19 Oct 2025",
    project: "Landing page campaña",
    responsible: "María García",
    hours: 3.5,
  },
  {
    id: "7",
    task: "Implementación de componentes",
    date: "18 Oct 2025",
    project: "Rediseño web corporativo",
    responsible: "Carlos Ruiz",
    hours: 5.0,
  },
  {
    id: "8",
    task: "Testing y ajustes",
    date: "17 Oct 2025",
    project: "Landing page campaña",
    responsible: "David Martín",
    hours: 2.5,
  },
];

const projectColors: Record<string, string> = {
  "Rediseño web corporativo": "bg-chart-1/20 text-chart-1 border-chart-1/30",
  "App móvil cliente": "bg-chart-2/20 text-chart-2 border-chart-2/30",
  "Sistema de gestión interno": "bg-chart-3/20 text-chart-3 border-chart-3/30",
  "Landing page campaña": "bg-chart-4/20 text-chart-4 border-chart-4/30",
};

export function RecentActivityTable() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Últimas tareas registradas</CardTitle>
        <Button variant="ghost" className="group">
          Ver todas las tareas
          <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Tarea</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell className="max-w-md">
                    {activity.task}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {activity.date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={projectColors[activity.project] || ""}
                    >
                      {activity.project}
                    </Badge>
                  </TableCell>
                  <TableCell>{activity.responsible}</TableCell>
                  <TableCell className="text-right">
                    {activity.hours}h
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
