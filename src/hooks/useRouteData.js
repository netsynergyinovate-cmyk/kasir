import { useState, useEffect, useMemo } from 'react';
import { customerVisitStatus, pendingStops } from '../utils/visits';
import { fetchRoadRoute } from '../utils/routing';
import { buildRoutePoints, legIndexFor } from '../utils/location';

export const hasCoords = (customer) => typeof customer.lat === 'number' && typeof customer.lng === 'number';

// Data rute kunjungan yang dipakai bersama halaman Rute dan kartu peta di Dashboard:
// urutan rute, status tiap rumah, tujuan berikutnya, titik peta, dan jalur jalan (OSRM).
// onlyPending: peta/jalur hanya melewati rumah yang masih perlu didatangi (untuk Dashboard yang ringkas).
// origin: posisi admin { lat, lng }; jika ada, jalur jalan dimulai dari posisi itu menuju rumah pertama.
export function useRouteData({ customers, transactions, visits, onlyPending = false, origin = null }) {
  const [roadRoute, setRoadRoute] = useState({ key: '', data: null });

  const routeCustomers = useMemo(
    () => customers
      .filter((customer) => customer.route_order !== null && customer.route_order !== undefined)
      .sort((a, b) => a.route_order - b.route_order),
    [customers],
  );

  const statusById = useMemo(() => {
    const map = {};
    customers.forEach((customer) => {
      map[customer.id] = customerVisitStatus(customer, visits, transactions);
    });
    return map;
  }, [customers, visits, transactions]);

  const pending = useMemo(() => pendingStops(routeCustomers, statusById), [routeCustomers, statusById]);
  const paidCount = routeCustomers.filter((customer) => statusById[customer.id]?.key === 'sudah_bayar').length;
  const waitingCount = routeCustomers.filter((customer) => statusById[customer.id]?.key === 'menunggu').length;

  // Nomor mengikuti urutan rute superadmin, walau yang tampil hanya sebagian rumah.
  const routeNumberById = useMemo(() => {
    const numberById = {};
    routeCustomers.forEach((customer, index) => { numberById[customer.id] = index + 1; });
    return numberById;
  }, [routeCustomers]);

  const mappedStops = useMemo(
    () => (onlyPending ? pending : routeCustomers)
      .map((customer) => ({ customer, number: routeNumberById[customer.id] }))
      .filter(({ customer }) => hasCoords(customer)),
    [routeCustomers, pending, onlyPending, routeNumberById],
  );

  const originKey = origin ? `o:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|` : '';
  const routeKey = originKey + mappedStops.map(({ customer }) => `${customer.lat},${customer.lng}`).join('|');
  const pointCount = mappedStops.length + (origin ? 1 : 0);

  useEffect(() => {
    if (pointCount < 2) return undefined;
    let cancelled = false;
    const points = buildRoutePoints(origin, mappedStops.map(({ customer }) => ({ lat: customer.lat, lng: customer.lng })));
    fetchRoadRoute(points).then((data) => {
      if (!cancelled) setRoadRoute({ key: routeKey, data });
    });
    return () => { cancelled = true; };
    // routeKey mewakili isi mappedStops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const roadReady = roadRoute.key === routeKey;
  const route = roadReady ? roadRoute.data : null;
  const routeLoading = pointCount >= 2 && !roadReady;

  // Ruas jalan dari rumah sebelumnya, per id pelanggan (hanya untuk rumah yang punya koordinat).
  const legBefore = {};
  if (route) {
    mappedStops.forEach(({ customer }, index) => {
      const legIndex = legIndexFor(Boolean(origin), index);
      if (legIndex >= 0 && route.legs[legIndex]) legBefore[customer.id] = route.legs[legIndex];
    });
  }

  const mapStops = useMemo(
    () => mappedStops.map(({ customer, number }) => ({
      id: customer.id,
      lat: customer.lat,
      lng: customer.lng,
      number,
      tone: statusById[customer.id]?.tone,
      title: customer.name,
    })),
    [mappedStops, statusById],
  );

  return {
    routeCustomers,
    statusById,
    pending,
    nextStop: pending[0] || null,
    afterNext: pending[1] || null,
    paidCount,
    waitingCount,
    routeNumberById,
    mapStops,
    route,
    routeLoading,
    legBefore,
    hasOrigin: Boolean(origin),
  };
}
