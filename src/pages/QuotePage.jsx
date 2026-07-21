import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../context/CMSContext';
import { useTheme } from '../context/ThemeContext';

export default function QuotePage() {
  const { cms } = useCMS();
  const { theme } = useTheme();

  const [service, setService] = useState('thesis');
  const [level, setLevel] = useState('undergraduate');
  const [quantity, setQuantity] = useState(10);
  const [deadline, setDeadline] = useState('');

  // Safe fallback pricing if CMS is unavailable
  const pricing = cms?.pricing || {
    undergraduate: 20,
    masters: 30,
    phd: 40,
    assignment: 15,
    projectFlat: 250,
    oddJobFlat: 100,
    rush48hour: 50,
    rush7day: 25
  };

  // Local date avoids UTC timezone problems
  const today = new Date();
  const todayString = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  )
    .toISOString()
    .split('T')[0];


  const calculation = useMemo(() => {
    if (!deadline) return null;

    const currentDate = new Date(todayString);
    const selectedDate = new Date(deadline);

    const days = Math.ceil(
      (selectedDate - currentDate) /
        (1000 * 60 * 60 * 24)
    );

    if (days < 0) {
      return {
        error: 'Deadline cannot be in the past.'
      };
    }


    let base = 0;
    const detailParts = [];


    switch (service) {
      case 'thesis': {
        const rate = pricing[level] || 0;

        base = rate * quantity;

        detailParts.push(
          `${level.charAt(0).toUpperCase() + level.slice(1)} thesis: ${quantity} page${
            quantity !== 1 ? 's' : ''
          } × $${rate}/page = $${base}`
        );

        break;
      }


      case 'assignment': {
        const rate = pricing.assignment || 0;

        base = rate * quantity;

        detailParts.push(
          `Assignment: ${quantity} page${
            quantity !== 1 ? 's' : ''
          } × $${rate}/page = $${base}`
        );

        break;
      }


      case 'project': {
        base = pricing.projectFlat || 0;

        detailParts.push(
          `Research project: flat fee = $${base}`
        );

        break;
      }


      case 'oddjob': {
        base = pricing.oddJobFlat || 0;

        detailParts.push(
          `Odd job: flat fee = $${base}`
        );

        break;
      }


      default:
        break;
    }


    let multiplier = 1;


    if (days <= 2) {
      const rush = pricing.rush48hour || 0;

      multiplier += rush / 100;

      detailParts.push(
        `Rush delivery (≤48h): +${rush}%`
      );

    } else if (days <= 7) {

      const rush = pricing.rush7day || 0;

      multiplier += rush / 100;

      detailParts.push(
        `Rush delivery (≤7 days): +${rush}%`
      );

    } else {

      detailParts.push(
        'Standard delivery: no rush fee'
      );

    }


    const total = Math.round(base * multiplier);


    return {
      days,
      base,
      multiplier,
      total,
      detailParts
    };


  }, [
    service,
    level,
    quantity,
    deadline,
    pricing,
    todayString
  ]);



  const serviceLabel = {
    thesis: 'Thesis / Dissertation',
    assignment: 'Assignment / Coursework',
    project: 'Research Project',
    oddjob: 'Odd Job'
  };



  return (
    <div
      className="quote-page"
      style={{
        padding: '4rem 0'
      }}
    >

      <div className="container">


        <div className="section-header">

          <span className="label">
            Pricing Calculator
          </span>


          <h1
            className="section-title"
            style={{
              marginTop: '0.5rem'
            }}
          >
            Get an Instant Quote
          </h1>


          <p className="section-subtitle">
            Transparent pricing based on your service,
            academic level, and deadline.
          </p>

        </div>




        <div
          className="card quote-card"
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '2rem',
            background:
              theme === 'dark'
                ? 'var(--bg-surface)'
                : 'var(--bg-card)'
          }}
        >



          <div className="form-group">

            <label className="form-label">
              Service Type
            </label>


            <select
              className="form-select"
              value={service}
              onChange={(e) =>
                setService(e.target.value)
              }
            >

              <option value="thesis">
                Thesis / Dissertation
              </option>

              <option value="assignment">
                Assignment / Coursework
              </option>

              <option value="project">
                Research Project
              </option>

              <option value="oddjob">
                Odd Job
              </option>

            </select>

          </div>





          {(service === 'thesis' ||
            service === 'assignment') && (

            <div className="form-group">

              <label className="form-label">
                Academic Level
              </label>


              <select
                className="form-select"
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value)
                }
              >

                <option value="undergraduate">
                  Undergraduate
                </option>

                <option value="masters">
                  Master's
                </option>

                <option value="phd">
                  PhD
                </option>

              </select>


            </div>

          )}






          {(service === 'thesis' ||
            service === 'assignment') && (

            <div className="form-group">

              <label className="form-label">
                Number of Pages
              </label>


              <input
                type="number"
                className="form-input"
                min="1"
                max="500"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(
                      1,
                      Number(e.target.value)
                    )
                  )
                }
              />


              <small
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem'
                }}
              >
                Estimated ~250 words per page
              </small>


            </div>

          )}






          <div className="form-group">

            <label className="form-label">
              Deadline
            </label>


            <input
              type="date"
              className="form-input"
              min={todayString}
              value={deadline}
              onChange={(e) =>
                setDeadline(e.target.value)
              }
            />

          </div>







          {calculation &&
            !calculation.error && (

            <div
              className="price-display"
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                borderRadius:
                  'var(--radius-md)',
                background:
                  theme === 'dark'
                    ? 'rgba(122,75,168,0.12)'
                    : 'rgba(122,75,168,0.06)',
                border:
                  '1px solid var(--border-strong)'
              }}
            >

              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}
              >
                {serviceLabel[service]}
                {' — '}
                {calculation.days}
                {' '}
                day
                {calculation.days !== 1 ? 's' : ''}
                {' until deadline'}
              </div>



              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  margin:
                    '0.75rem 0'
                }}
              >
                ${calculation.total}
              </div>




              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}
              >

                {calculation.detailParts.map(
                  (part, index) => (
                    <div key={index}>
                      {part}
                    </div>
                  )
                )}


                <div
                  style={{
                    marginTop: '0.5rem',
                    fontWeight: 700,
                    color:
                      'var(--text-primary)'
                  }}
                >
                  Total: ${calculation.total}
                </div>


              </div>


            </div>

          )}






          {calculation &&
            calculation.error && (

            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                borderRadius:
                  'var(--radius-md)',
                background:
                  'rgba(220,38,38,0.08)',
                border:
                  '1px solid rgba(220,38,38,0.25)',
                color:
                  'var(--danger)'
              }}
            >
              {calculation.error}
            </div>

          )}







          <div
            style={{
              marginTop: '2rem',
              textAlign: 'center'
            }}
          >


            <Link
              to="/client/order"
              state={{
                service,
                level,
                quantity,
                deadline,
                estimatedPrice:
                  calculation?.total || 0
              }}
              className="btn btn-primary btn-lg"
              style={{
                width: '100%'
              }}
            >
              Get Quote
            </Link>



            <p
              style={{
                marginTop: '0.75rem',
                fontSize: '0.8rem',
                color:
                  'var(--text-muted)'
              }}
            >
              No payment required to place your order.
              Full ownership upon completion.
            </p>


          </div>



        </div>


      </div>


    </div>
  );
}