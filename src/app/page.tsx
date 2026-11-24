'use client'

import { useEffect, useState, useCallback, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Star,
  RefreshCw,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Sparkles,
  Smartphone,
  Monitor,
  Palette,
  Settings2,
  Code2,
  Eye,
} from "lucide-react"
import type {
  ShopConfig,
  ShopData,
  PublicPayload,
  PublicReview,
  PlaceCandidate,
} from "@/lib/types"

const DEFAULT_SHOP = "noovi-co.myshopify.com"

export default function Home() {
  const { toast } = useToast()
  const [shopDomain, setShopDomain] = useState(DEFAULT_SHOP)
  const [shop, setShop] = useState<ShopData | null>(null)
  const [payload, setPayload] = useState<PublicPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState("Noovi Ein Dor")
  const [searchApiKey, setSearchApiKey] = useState("")
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([])

  // Config form state — mirrors shop.config
  const [cfg, setCfg] = useState<ShopConfig | null>(null)
  const [businessName, setBusinessName] = useState("")
  const [placeId, setPlaceId] = useState("")
  const [apiKey, setApiKey] = useState("")

  const previewFrameRef = useRef<HTMLIFrameElement | null>(null)

  const toastRef = useRef(toast)
  toastRef.current = toast

  const loadShop = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/config?shop=${encodeURIComponent(shopDomain)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      const s: ShopData = data.shop
      setShop(s)
      setCfg(s.config)
      setBusinessName(s.businessName ?? "")
      setPlaceId(s.placeId ?? "")
      setApiKey(s.googleApiKey ?? "")
    } catch (e: any) {
      toastRef.current({
        title: "Failed to load shop",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [shopDomain])

  const loadPublic = useCallback(async () => {
    try {
      const r = await fetch(`/api/reviews/public?shop=${encodeURIComponent(shopDomain)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const p: PublicPayload = await r.json()
      setPayload(p)
    } catch (e) {
      // Silent — preview just won't update
    }
  }, [shopDomain])

  useEffect(() => {
    loadShop()
    loadPublic()
  }, [loadShop, loadPublic])

  // Re-render preview widget whenever cfg changes (debounced)
  useEffect(() => {
    if (!payload || !cfg) return
    const t = setTimeout(() => {
      reloadPreview()
    }, 200)
    return () => clearTimeout(t)
  }, [cfg, payload])

  function reloadPreview() {
    // Reload the iframe to re-run embed.js with current config
    const f = previewFrameRef.current
    if (!f) return
    f.src = f.src
  }

  function patchCfg(partial: Partial<ShopConfig>) {
    setCfg((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  async function saveConfig() {
    if (!cfg) return
    setSaving(true)
    try {
      const r = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          businessName,
          placeId,
          googleApiKey: apiKey || null,
          ...cfg,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${r.status}`)
      }
      await loadShop()
      await loadPublic()
      toast({
        title: "Saved",
        description: "Configuration updated. Preview refreshed.",
      })
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function refreshReviews() {
    if (!placeId || !apiKey) {
      toast({
        title: "Missing credentials",
        description: "Set Place ID and Google API key first.",
        variant: "destructive",
      })
      return
    }
    setRefreshing(true)
    try {
      const r = await fetch(
        `/api/admin/refresh?shop=${encodeURIComponent(shopDomain)}`,
        { method: "POST" }
      )
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${r.status}`)
      }
      const data = await r.json()
      await loadShop()
      await loadPublic()
      if (data.result?.ok) {
        toast({
          title: "Reviews refreshed",
          description: `Fetched ${data.result.fetched} reviews. Avg ${data.result.rating ?? "?"} ★ from ${data.result.userRatingTotal ?? "?"} reviews.`,
        })
      } else {
        toast({
          title: "Refresh failed",
          description: data.result?.error ?? "Unknown error",
          variant: "destructive",
        })
      }
    } catch (e: any) {
      toast({
        title: "Refresh failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function searchPlace() {
    if (!searchQuery.trim() || !searchApiKey.trim()) {
      toast({
        title: "Missing input",
        description: "Enter your Google Places API key and a search query.",
        variant: "destructive",
      })
      return
    }
    setSearching(true)
    setPlaceCandidates([])
    try {
      const r = await fetch("/api/admin/search-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, apiKey: searchApiKey }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${r.status}`)
      }
      const data = await r.json()
      setPlaceCandidates(data.places || [])
      if (!data.places || data.places.length === 0) {
        toast({
          title: "No results",
          description: "Try a different query (e.g. your full business name + city).",
          variant: "destructive",
        })
      }
    } catch (e: any) {
      toast({
        title: "Search failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSearching(false)
    }
  }

  function copySnippet() {
    const origin = window.location.origin
    const snippet = `<!-- Noovi Google Reviews -->
<div id="noovi-reviews-root"></div>
<script src="${origin}/embed.js?shop=${encodeURIComponent(
      shopDomain
    )}" async></script>`
    navigator.clipboard.writeText(snippet)
    toast({ title: "Snippet copied", description: "Paste into a Shopify Custom Liquid block." })
  }

  if (loading || !cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const lastSynced = shop?.lastSyncedAt
    ? new Date(shop.lastSyncedAt).toLocaleString("en-GB")
    : "Never"

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight truncate">
                Noovi Reviews App
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                Google Reviews for {shopDomain} · daily auto-refresh · fast &amp; lightweight
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Input
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value.trim().toLowerCase())}
              className="h-9 flex-1 min-w-0 sm:w-56 sm:flex-none"
              placeholder="shop.myshopify.com"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                loadShop()
                loadPublic()
              }}
            >
              Load
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Save config
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={refreshReviews}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync now
            </Button>
          </div>
        </div>
        {/* Status strip */}
        <div className="bg-muted/50 border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-4 flex-wrap text-xs">
            <span className="flex items-center gap-1.5">
              <Badge variant="outline">{shop?.rating?.toFixed(1) ?? "?"} ★</Badge>
              <span className="text-muted-foreground">
                {shop?.userRatingTotal ?? 0} reviews
              </span>
            </span>
            <span className="text-muted-foreground">Last sync: {lastSynced}</span>
            {shop?.lastSyncStatus && (
              <Badge
                variant={
                  shop.lastSyncStatus === "ok"
                    ? "default"
                    : shop.lastSyncStatus === "demo"
                    ? "secondary"
                    : "destructive"
                }
              >
                {shop.lastSyncStatus}
              </Badge>
            )}
            {shop?.lastSyncError && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span className="truncate max-w-[400px]">{shop.lastSyncError}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 gap-1">
            <TabsTrigger value="config" className="gap-1">
              <Settings2 className="w-4 h-4" /> Config
            </TabsTrigger>
            <TabsTrigger value="sizing" className="gap-1">
              <Monitor className="w-4 h-4" /> Sizing
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-1">
              <Palette className="w-4 h-4" /> Theme
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="w-4 h-4" /> Preview
            </TabsTrigger>
            <TabsTrigger value="install" className="gap-1">
              <Code2 className="w-4 h-4" /> Install
            </TabsTrigger>
          </TabsList>

          {/* Config tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Google connection</CardTitle>
                <CardDescription>
                  We need a Google Place ID and a Places API key to fetch reviews
                  daily. The API key stays on the server — it is never exposed to the
                  storefront.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Noovi.co"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placeId">Google Place ID</Label>
                  <Input
                    id="placeId"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="ChIJma3fi-NFHBURlbumr4zRmgQ"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Don&apos;t know it? Use the finder below.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Google Places API key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create one in the Google Cloud Console — enable the
                    &quot;Places API (New)&quot;.
                  </p>
                </div>

                <Separator />

                {/* Place ID finder */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Find my Place ID</h4>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Business name + city (e.g. Noovi Ein Dor)"
                      className="flex-1"
                    />
                    <Input
                      value={searchApiKey}
                      onChange={(e) => setSearchApiKey(e.target.value)}
                      type="password"
                      placeholder="API key"
                      className="flex-1"
                    />
                    <Button onClick={searchPlace} disabled={searching} variant="secondary">
                      {searching ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4 mr-2" />
                      )}
                      Search
                    </Button>
                  </div>
                  {placeCandidates.length > 0 && (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto rounded-md border p-2">
                      {placeCandidates.map((p) => (
                        <button
                          key={p.placeId}
                          type="button"
                          onClick={() => {
                            setPlaceId(p.placeId)
                            if (!businessName && p.displayName)
                              setBusinessName(p.displayName)
                            setPlaceCandidates([])
                            toast({
                              title: "Place ID selected",
                              description: p.placeId,
                            })
                          }}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-start justify-between gap-2"
                        >
                          <span className="text-sm">{p.displayName}</span>
                          <code className="text-xs text-muted-foreground break-all">
                            {p.placeId}
                          </code>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Behavior</CardTitle>
                <CardDescription>Carousel &amp; widget behaviour.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Max reviews shown: {cfg.maxReviews}</Label>
                  <Slider
                    min={1}
                    max={50}
                    step={1}
                    value={[cfg.maxReviews]}
                    onValueChange={([v]) => patchCfg({ maxReviews: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Autoplay speed: {(cfg.autoplaySpeed / 1000).toFixed(1)}s</Label>
                  <Slider
                    min={1000}
                    max={15000}
                    step={500}
                    value={[cfg.autoplaySpeed]}
                    onValueChange={([v]) => patchCfg({ autoplaySpeed: v })}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <ToggleRow
                    label="Autoplay carousel"
                    desc="Auto-advance through reviews"
                    checked={cfg.autoplay}
                    onChange={(v) => patchCfg({ autoplay: v })}
                  />
                  <ToggleRow
                    label="Show header"
                    desc="Average stars + total reviews + write button"
                    checked={cfg.showHeader}
                    onChange={(v) => patchCfg({ showHeader: v })}
                  />
                  <ToggleRow
                    label="Show &quot;Write a review&quot; button"
                    desc="Links to your Google reviews page"
                    checked={cfg.showWriteButton}
                    onChange={(v) => patchCfg({ showWriteButton: v })}
                  />
                  <ToggleRow
                    label="RTL layout"
                    desc="Hebrew / Arabic right-to-left"
                    checked={cfg.rtl}
                    onChange={(v) => patchCfg({ rtl: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sizing tab */}
          <TabsContent value="sizing" className="space-y-4 mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Desktop
                  </CardTitle>
                  <CardDescription>
                    Card sizes for screens &gt; 767px. Your store&apos;s main content
                    column on desktop typically fits 3 cards at 320px each.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <NumberSlider
                    label="Card width"
                    value={cfg.desktopCardWidth}
                    min={220}
                    max={500}
                    step={10}
                    unit="px"
                    onChange={(v) => patchCfg({ desktopCardWidth: v })}
                  />
                  <NumberSlider
                    label="Card min-height"
                    value={cfg.desktopCardHeight}
                    min={120}
                    max={400}
                    step={10}
                    unit="px"
                    onChange={(v) => patchCfg({ desktopCardHeight: v })}
                  />
                  <NumberSlider
                    label="Gap between cards"
                    value={cfg.desktopCardGap}
                    min={0}
                    max={40}
                    step={2}
                    unit="px"
                    onChange={(v) => patchCfg({ desktopCardGap: v })}
                  />
                  <NumberSlider
                    label="Cards visible at once"
                    value={cfg.desktopCardsVisible}
                    min={1}
                    max={6}
                    step={1}
                    unit=""
                    onChange={(v) => patchCfg({ desktopCardsVisible: v })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Mobile
                  </CardTitle>
                  <CardDescription>
                    Card sizes for screens ≤ 767px. Most Shopify themes fit a single
                    card with peek of the next on phones.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <NumberSlider
                    label="Card width"
                    value={cfg.mobileCardWidth}
                    min={200}
                    max={400}
                    step={10}
                    unit="px"
                    onChange={(v) => patchCfg({ mobileCardWidth: v })}
                  />
                  <NumberSlider
                    label="Card min-height"
                    value={cfg.mobileCardHeight}
                    min={120}
                    max={400}
                    step={10}
                    unit="px"
                    onChange={(v) => patchCfg({ mobileCardHeight: v })}
                  />
                  <NumberSlider
                    label="Gap between cards"
                    value={cfg.mobileCardGap}
                    min={0}
                    max={30}
                    step={2}
                    unit="px"
                    onChange={(v) => patchCfg({ mobileCardGap: v })}
                  />
                  <NumberSlider
                    label="Cards visible at once"
                    value={cfg.mobileCardsVisible}
                    min={1}
                    max={3}
                    step={1}
                    unit=""
                    onChange={(v) => patchCfg({ mobileCardsVisible: v })}
                  />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="py-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5" />
                Tip: hitting &quot;Save config&quot; applies changes to your live storefront
                instantly — no theme edit needed.
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme tab */}
          <TabsContent value="theme" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
                <CardDescription>
                  Match the widget to your store. Default mirrors your current entanglecommerce
                  widget (Google orange + light grey cards).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <ColorRow
                  label="Accent (stars &amp; arrows)"
                  value={cfg.accentColor}
                  onChange={(v) => patchCfg({ accentColor: v })}
                />
                <ColorRow
                  label="Card background"
                  value={cfg.cardBg}
                  onChange={(v) => patchCfg({ cardBg: v })}
                />
                <ColorRow
                  label="Card text"
                  value={cfg.cardTextColor}
                  onChange={(v) => patchCfg({ cardTextColor: v })}
                />
                <ColorRow
                  label="Widget background"
                  value={cfg.widgetBg}
                  onChange={(v) => patchCfg({ widgetBg: v })}
                />
              </CardContent>
              <CardFooter className="bg-muted/30 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Current noovi.co style: cardBg #f6f6f8, accent #fe8403, cardText #303030.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patchCfg({
                      accentColor: "#fe8403",
                      cardBg: "#f6f6f8",
                      cardTextColor: "#303030",
                      widgetBg: "#ffffff",
                    })
                  }
                >
                  Reset to noovi defaults
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Preview tab */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Live storefront preview
                </CardTitle>
                <CardDescription>
                  This is exactly what shoppers will see. Renders the same
                  <code className="mx-1 text-xs bg-muted px-1.5 py-0.5 rounded">embed.js</code>
                  that runs on your Shopify store. Resize the window to test mobile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden bg-background">
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 text-xs text-muted-foreground">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400" />
                      <span className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <span className="ml-2">noovi.co — storefront preview</span>
                  </div>
                  <iframe
                    ref={previewFrameRef}
                    title="Storefront preview"
                    src={`/preview?shop=${encodeURIComponent(shopDomain)}`}
                    className="w-full"
                    style={{ height: 540, border: "none" }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Install tab */}
          <TabsContent value="install" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Install on Shopify</CardTitle>
                <CardDescription>
                  Two-minute setup — no theme file editing, no app store listing required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ol className="space-y-4 list-decimal list-inside text-sm leading-relaxed">
                  <li>
                    In your Shopify admin go to <b>Online Store → Themes → Customize</b>.
                  </li>
                  <li>
                    Pick the section where you want the reviews to appear (typically
                    a <b>Custom Liquid</b> block on the homepage, between the product
                    slider and the blog section).
                  </li>
                  <li>
                    Paste this snippet into the Custom Liquid block:
                  </li>
                </ol>
                <div className="rounded-md bg-zinc-900 text-zinc-100 p-4 font-mono text-xs overflow-x-auto">
                  {`<!-- Noovi Google Reviews -->
<div id="noovi-reviews-root"></div>
<script src="${typeof window !== "undefined" ? window.location.origin : "https://YOUR-APP-HOST"}/embed.js?shop=${shopDomain}" async></script>`}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={copySnippet}>
                    <Copy className="w-4 h-4 mr-2" /> Copy snippet
                  </Button>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(
                      placeId || ""
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="secondary">
                      <ExternalLink className="w-4 h-4 mr-2" /> View your Google place
                    </Button>
                  </a>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Set up the daily auto-refresh</h4>
                  <p className="text-xs text-muted-foreground">
                    Add a daily cron job that pings this URL once a day (any time):
                  </p>
                  <div className="rounded-md bg-zinc-900 text-zinc-100 p-3 font-mono text-xs overflow-x-auto">
                    GET {typeof window !== "undefined" ? window.location.origin : "https://YOUR-APP-HOST"}/api/cron/refresh?token=YOUR_CRON_SECRET
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set <code className="text-xs">CRON_SECRET</code> in your hosting
                    provider&apos;s env vars. On Vercel use vercel.json cron; on Render use
                    a Cron Job; on GitHub Actions use a scheduled workflow. Any of them
                    will work — they just need to hit the URL once per day.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-background mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>Noovi Reviews App · cached Google Places data · refreshed daily</span>
          <span>
            Reviews served from: <code>/api/reviews/public?shop={shopDomain}</code>
          </span>
        </div>
      </footer>
    </div>
  )
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="space-y-0.5">
        <div className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: label }} />
        <div className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: desc }} />
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm" dangerouslySetInnerHTML={{ __html: label }} />
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-md border cursor-pointer p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm flex-1"
        />
      </div>
    </div>
  )
}
