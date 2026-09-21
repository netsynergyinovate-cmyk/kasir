import { useState, useEffect, useMemo } from 'react';
import { customerVisitStatus, pendingStops } from '../utils/visits';
import { fetchRoadRoute } from '../utils/routing';

export const hasCoords = (customer) => typeof customer.lat === 'number' && typeof customer.lng === 'number';

// Data rute kunjungan yang dipakai bersama halaman Rute dan kartu peta di Dashboard:
// urutan rute, status tiap rumah, tujuan berikutnya, titik peta, dan jalur jalan (OSRM).
export function useRouteData({ customers, transactions, visits }) {
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

  const pending = pendingStops(routeCustomers, statusById);
  const paidCount = routeCustomers.filter((customer) => statusById[customer.id]?.key === 'sudah_bayar').length;

  const mappedStops = useMemo(
    () => routeCustomers
      .map((customer, index) => ({ customer, number: index + 1 }))
      .filter(({ customer }) => hasCoords(customer)),
    [routeCustomers],
  );

  const routeKey = mappedStops.map(({ customer }) => `${customer.lat},${customer.lng}`).join('|');

  useEffect(() => {
    if (mappedStops.length < 2) return undefined;
    let cancelled = false;
    fetchRoadRoute(mappedStops.map(({ customer }) => ({ lat: customer.lat, lng: customer.lng }))).then((data) => {
      if (!cancelled) setRoadRoute({ key: routeKey, data });
    });
    return () => { cancelled = true; };
    // routeKey mewakili isi mappedStops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const roadReady = roadRoute.key === routeKey;
  const route = roadReady ? roadRoute.data : null;
  const routeLoading = mappedStops.length >= 2 && !roadReady;

  // Ruas jalan dari rumah sebelumnya, per id pelanggan (hanya untuk rumah yang punya koordinat).
  const legBefore = {};
  if (route) {
    mappedStops.forEach(({ customer }, index) => {
      if (index > 0 && route.legs[index - 1]) legBefore[customer.id] = route.legs[index - 1];
    });
  }

  const mapStops = useMemo(
    () => mappedStops.map(({ customer, number }) => ({
      id: customer.id,
      lat: customer.lat,
      lng: customer.lng,
      number,
      statusKey: statusById[customer.id]?.key,
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
    mapStops,
    route,
    routeLoading,
    legBefore,
  };
}
