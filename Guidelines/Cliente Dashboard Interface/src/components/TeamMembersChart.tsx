import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  hours: number;
  avatar: string;
  initials: string;
  color: string;
}

const teamMembers: TeamMember[] = [
  {
    id: "1",
    name: "María García",
    role: "UX/UI Designer",
    hours: 28,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    initials: "MG",
    color: "#5CFFBE",
  },
  {
    id: "2",
    name: "Carlos Ruiz",
    role: "Frontend Developer",
    hours: 35,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos",
    initials: "CR",
    color: "#7B68EE",
  },
  {
    id: "3",
    name: "Ana López",
    role: "Project Manager",
    hours: 12,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ana",
    initials: "AL",
    color: "#FFD93D",
  },
  {
    id: "4",
    name: "David Martín",
    role: "Backend Developer",
    hours: 8,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    initials: "DM",
    color: "#FF6B9D",
  },
];

export function TeamMembersChart() {
  const maxHours = Math.max(...teamMembers.map((m) => m.hours));

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Horas por miembro del equipo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {teamMembers.map((member) => {
          const percentage = (member.hours / maxHours) * 100;
          
          return (
            <div key={member.id} className="space-y-3">
              <div className="flex items-center gap-4">
                <Avatar className="size-12 border-2" style={{ borderColor: member.color }}>
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback className="text-primary-foreground" style={{ backgroundColor: member.color }}>
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div>
                      <p className="text-foreground">{member.name}</p>
                      <p className="text-muted-foreground text-sm">{member.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-foreground">{member.hours}h</p>
                    </div>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: member.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
