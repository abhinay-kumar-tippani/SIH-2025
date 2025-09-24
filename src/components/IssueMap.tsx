import React, { useState, useEffect, useRef } from "react";
import { MapPin, Filter, Layers, Info, ThumbsUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import mapboxgl from "mapbox-gl";
import supabase from "@/lib/supabaseClient";
import { useI18n } from "@/lib/i18n";

interface Issue {
  id: string;
  category: string;
  status: "pending" | "in-progress" | "resolved";
  location: {
    lat: number;
    lng: number;
  };
  description: string;
  reportedAt: Date;
  address?: string;
}

interface IssueMapProps {
  issues?: Issue[];
  currentLocation?: { lat: number; lng: number };
  onMarkerClick?: (issue: Issue) => void;
  onFilterChange?: (filters: {
    categories: string[];
    statuses: string[];
  }) => void;
}

const IssueMap: React.FC<IssueMapProps> = ({
  issues = [
    {
      id: "1",
      category: "Pothole",
      status: "pending",
      location: { lat: 40.7128, lng: -74.006 },
      description: "Large pothole in the middle of the road",
      reportedAt: new Date(),
      address: "123 Main St",
    },
    {
      id: "2",
      category: "Graffiti",
      status: "in-progress",
      location: { lat: 40.7138, lng: -74.008 },
      description: "Graffiti on public building wall",
      reportedAt: new Date(),
      address: "456 Park Ave",
    },
    {
      id: "3",
      category: "Broken Light",
      status: "resolved",
      location: { lat: 40.7148, lng: -74.003 },
      description: "Street light not working",
      reportedAt: new Date(),
      address: "789 Broadway",
    },
  ],
  currentLocation = { lat: 40.7128, lng: -74.006 },
  onMarkerClick = () => {},
  onFilterChange = () => {},
}) => {
  const { t } = useI18n();
  const [selectedFilters, setSelectedFilters] = useState<{
    categories: string[];
    statuses: string[];
  }>({
    categories: [],
    statuses: [],
  });

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Voting state
  const [votesMap, setVotesMap] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedVotes, setSelectedVotes] = useState<number>(0);
  const [selectedHasVoted, setSelectedHasVoted] = useState<boolean>(false);
  const [voting, setVoting] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!mapContainerRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 14,
      pitch: 60,
      bearing: 20,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.on("load", () => {
      try {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.terrain-rgb",
          tileSize: 512,
          maxzoom: 14,
        } as any);
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        } as any);
      } catch {}
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [currentLocation.lat, currentLocation.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // issue markers
    issues.forEach((issue) => {
      const marker = new mapboxgl.Marker({ color: getStatusHex(issue.status) })
        .setLngLat([issue.location.lng, issue.location.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(`
            <div style="min-width:160px">
              <p style="font-weight:600;display:flex;align-items:center;gap:6px">${getCategoryIcon(issue.category)} ${issue.category}</p>
              <p style="font-size:12px;color:#6b7280;margin-top:2px">${issue.address || ""}</p>
              <p style="font-size:14px;margin-top:6px">${issue.description}</p>
              <div style="margin-top:6px;font-size:12px;color:#6b7280">${
                votesMap[issue.id] || 0
              } ${t("votes")}</div>
            </div>
          `),
        );
      marker.getElement().addEventListener("click", () => handleMarkerClick(issue));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // current location marker
    const you = new mapboxgl.Marker({ color: "#2563eb" })
      .setLngLat([currentLocation.lng, currentLocation.lat])
      .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(t("your_location")));
    you.addTo(map);
    markersRef.current.push(you);
  }, [issues, currentLocation, votesMap]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
      setUserEmail(data.user?.email || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id || null);
      setUserEmail(session?.user?.email || null);
    });
    return () => sub?.subscription.unsubscribe();
  }, []);

  // Fetch votes for markers
  useEffect(() => {
    const ids = issues.map((i) => i.id);
    if (!ids.length) return;
    (async () => {
      const { data } = await supabase
        .from("report_votes")
        .select("report_id")
        .in("report_id", ids);
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.report_id] = (counts[row.report_id] || 0) + 1;
      });
      setVotesMap(counts);
    })();
  }, [issues]);

  const refreshSelectedVotes = async (id: string) => {
    const { count } = await supabase
      .from("report_votes")
      .select("*", { count: "exact", head: true })
      .eq("report_id", id);
    setSelectedVotes(count || 0);
    setVotesMap((prev) => ({ ...prev, [id]: count || 0 }));
    if (userId) {
      const { data: v } = await supabase
        .from("report_votes")
        .select("id")
        .eq("report_id", id)
        .eq("voter_id", userId)
        .maybeSingle();
      setSelectedHasVoted(!!v);
    } else {
      setSelectedHasVoted(false);
    }
  };

  useEffect(() => {
    if (!selectedIssue) return;
    refreshSelectedVotes(selectedIssue.id);
    const channel = supabase
      .channel(`map-votes-${selectedIssue.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_votes", filter: `report_id=eq.${selectedIssue.id}` },
        () => refreshSelectedVotes(selectedIssue.id),
      )
      .subscribe();
    return () => channel.unsubscribe();
  }, [selectedIssue?.id, userId]);

  const handleVote = async () => {
    if (!selectedIssue) return;
    if (!userId) {
      alert(t('please_sign_in_to_vote'));
      return;
    }
    setVoting(true);
    try {
      if (!selectedHasVoted) {
        const { error } = await supabase.from("report_votes").insert({
          report_id: selectedIssue.id,
          voter_id: userId,
          voter_email: userEmail,
        });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("report_votes")
          .delete()
          .eq("report_id", selectedIssue.id)
          .eq("voter_id", userId);
        if (error) throw error;
      }
      await refreshSelectedVotes(selectedIssue.id);
    } catch (e) {
      alert(t('failed_update_vote'));
    } finally {
      setVoting(false);
    }
  };

  const handleFilterChange = (
    type: "categories" | "statuses",
    value: string,
  ) => {
    const newFilters = { ...selectedFilters };

    if (newFilters[type].includes(value)) {
      newFilters[type] = newFilters[type].filter((item) => item !== value);
    } else {
      newFilters[type] = [...newFilters[type], value];
    }

    setSelectedFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleMarkerClick = (issue: Issue) => {
    setSelectedIssue(issue);
    onMarkerClick(issue);
  };

  const categories = ["Pothole", "Graffiti", "Broken Light", "Trash", "Other"];
  const statuses = ["pending", "in-progress", "resolved"];

  const statusLabel = (s: string) => t(`status_${s.replace(/-/g, '_')}`);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "in-progress":
        return "bg-blue-500";
      case "resolved":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusHex = (status: string) => {
    switch (status) {
      case "pending":
        return "#eab308"; // yellow-500
      case "in-progress":
        return "#3b82f6"; // blue-500
      case "resolved":
        return "#22c55e"; // green-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "pothole":
        return "🕳️";
      case "graffiti":
        return "🖌️";
      case "broken light":
        return "💡";
      case "trash":
        return "🗑️";
      default:
        return "📍";
    }
  };

  return (
    <div className="relative w-full h-[500px] bg-white rounded-lg overflow-hidden">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        <Button variant="secondary" size="icon" className="bg-white shadow-md">
          <Layers className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="bg-white shadow-md"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-2">
              <p className="text-sm font-medium mb-2">{t('categories')}</p>
              <div className="flex flex-wrap gap-1">
                {categories.map((category) => (
                  <Badge
                    key={category}
                    variant={
                      selectedFilters.categories.includes(category)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => handleFilterChange("categories", category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <div className="p-2">
              <p className="text-sm font-medium mb-2">{t('status')}</p>
              <div className="flex flex-wrap gap-1">
                {statuses.map((status) => (
                  <Badge
                    key={status}
                    variant={
                      selectedFilters.statuses.includes(status)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => handleFilterChange("statuses", status)}
                  >
                    {statusLabel(status)}
                  </Badge>
                ))}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selected issue details */}
      {selectedIssue && (
        <Card className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-white shadow-lg z-[1000]">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  {getCategoryIcon(selectedIssue.category)}{" "}
                  {selectedIssue.category}
                  <Badge
                    variant="outline"
                    className={`ml-2 ${getStatusColor(selectedIssue.status)} bg-opacity-20`}
                  >
                    {statusLabel(selectedIssue.status)}
                  </Badge>
                </h3>
                <p className="text-sm text-gray-500">{selectedIssue.address}</p>
                <p className="text-sm mt-2">{selectedIssue.description}</p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant={selectedHasVoted ? "default" : "outline"} onClick={handleVote} disabled={voting}>
                    <ThumbsUp className="h-4 w-4 mr-1" /> {selectedHasVoted ? t('voted') : t('upvote')}
                  </Button>
                  <Badge variant="secondary">{selectedVotes} {t('votes')}</Badge>
                  {selectedVotes >= 3 && (
                    <Badge className="bg-green-600 text-white">{t('community_verified')}</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedIssue(null)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IssueMap;