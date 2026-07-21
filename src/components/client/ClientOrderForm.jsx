import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { useCMS } from "../../context/CMSContext";

export default function ClientOrderForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const quote = location.state || {};

  const { user } = useAuth();
  const { cms } = useCMS();

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


  const [service, setService] = useState(
    quote.service || 'thesis'
  );

  const [level, setLevel] = useState(
    quote.level || 'undergraduate'
  );

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');

  const [pages, setPages] = useState(
    quote.quantity || 10
  );

  const [deadline, setDeadline] = useState(
    quote.deadline || ''
  );

  const [requirements, setRequirements] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');


  const today = new Date();

  const todayString = new Date(
    today.getTime() -
      today.getTimezoneOffset() * 60000
  )
    .toISOString()
    .split('T')[0];



  const price = useMemo(() => {

    if (!deadline) return null;


    const now = new Date(todayString);
    const end = new Date(deadline);


    const days = Math.ceil(
      (end - now) /
        (1000 * 60 * 60 * 24)
    );


    if (days < 0) {
      return {
        error:
          'Deadline cannot be in the past.'
      };
    }


    let base = 0;


    switch (service) {

      case 'thesis':
        base =
          (pricing[level] || 0) *
          pages;
        break;


      case 'assignment':
        base =
          (pricing.assignment || 0) *
          pages;
        break;


      case 'project':
        base =
          pricing.projectFlat || 0;
        break;


      case 'oddjob':
        base =
          pricing.oddJobFlat || 0;
        break;


      default:
        break;
    }


    let multiplier = 1;


    if (days <= 2) {

      multiplier +=
        (pricing.rush48hour || 0) / 100;

    } else if (days <= 7) {

      multiplier +=
        (pricing.rush7day || 0) / 100;

    }


    return {
      days,
      base,
      multiplier,
      total:
        Math.round(
          base * multiplier
        )
    };


  }, [
    service,
    level,
    pages,
    deadline,
    pricing,
    todayString
  ]);




  const milestones = useMemo(() => {

    if (
      !deadline ||
      !price ||
      price.error
    ) {
      return [];
    }


    const start =
      new Date();


    const end =
      new Date(deadline);


    const totalDays =
      Math.max(
        1,
        Math.ceil(
          (end - start) /
          (1000 * 60 * 60 * 24)
        )
      );


    const interval =
      Math.floor(
        totalDays / 5
      );


    const labels = [
      'Outline & Research Plan',
      'Draft Section 1',
      'Draft Section 2',
      'Draft Section 3',
      'Final Review & Delivery'
    ];


    return labels.map(
      (label, index) => {

        const date =
          new Date(start);


        date.setDate(
          date.getDate() +
          interval *
          (index + 1)
        );


        if (date > end) {
          date.setTime(
            end.getTime()
          );
        }


        return {
          label,
          dueDate:
            date
              .toISOString()
              .split('T')[0],
          completed:false
        };

      }
    );


  }, [
    deadline,
    price
  ]);





  const handleSubmit = async (e) => {

    e.preventDefault();

    setError('');


    if (
      !subject.trim() ||
      !topic.trim() ||
      !deadline
    ) {

      setError(
        'Please fill in all required fields.'
      );

      return;
    }


    if (
      !user ||
      !user._id
    ) {

      setError(
        'You must be logged in to place an order.'
      );

      return;
    }



    setSubmitting(true);



    const orderPayload = {

      clientId:
        user._id,

      clientName:
        user.name,

      clientEmail:
        user.email,


      service,


      level:
        service === 'thesis' ||
        service === 'assignment'
          ? level
          : null,


      subject,

      topic,


      pages:
        service === 'thesis' ||
        service === 'assignment'
          ? pages
          : null,


      deadline,

      requirements,


      price:
        price?.total || 0,


      status:
        'Pending',


      milestones,


      createdAt:
        new Date()
          .toISOString()

    };



    try {


      const response =
        await fetch(
          '/api/orders',
          {
            method:'POST',

            headers:{
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                orderPayload
              )
          }
        );



      const data =
        await response.json();



      if (!response.ok) {

        throw new Error(
          data.message ||
          'Failed to create order'
        );

      }



      navigate(
        '/client/orders'
      );


    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setSubmitting(false);

    }

  };





  return (

    <div
      className="client-order-form"
      style={{
        padding:'2rem 0'
      }}
    >

      <div className="container">


        <div className="section-header">

          <h1 className="section-title">
            Place Your Order
          </h1>


          <p className="section-subtitle">
            Fill in your project details and
            we will match you with the right writer.
          </p>

        </div>



        <div
          className="card"
          style={{
            maxWidth:720,
            margin:'0 auto',
            padding:'2rem'
          }}
        >


          {error && (

            <div
              className="alert alert-danger"
              style={{
                marginBottom:'1rem'
              }}
            >
              {error}
            </div>

          )}




          <form onSubmit={handleSubmit}>


            <div className="form-group">

              <label className="form-label">
                Service Type
              </label>


              <select
                className="form-select"
                value={service}
                onChange={
                  e =>
                    setService(
                      e.target.value
                    )
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
                  onChange={
                    e =>
                      setLevel(
                        e.target.value
                      )
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






            <div className="form-group">

              <label className="form-label">
                Subject / Discipline *
              </label>


              <input
                className="form-input"
                value={subject}
                onChange={
                  e =>
                    setSubject(
                      e.target.value
                    )
                }
                required
              />

            </div>





            <div className="form-group">

              <label className="form-label">
                Topic / Title *
              </label>


              <input
                className="form-input"
                value={topic}
                onChange={
                  e =>
                    setTopic(
                      e.target.value
                    )
                }
                required
              />

            </div>





            {(service === 'thesis' ||
              service === 'assignment') && (

              <div className="form-group">

                <label className="form-label">
                  Pages
                </label>


                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={pages}
                  onChange={
                    e =>
                      setPages(
                        Number(
                          e.target.value
                        )
                      )
                  }
                />

              </div>

            )}






            <div className="form-group">

              <label className="form-label">
                Deadline *
              </label>


              <input
                type="date"
                className="form-input"
                min={todayString}
                value={deadline}
                onChange={
                  e =>
                    setDeadline(
                      e.target.value
                    )
                }
                required
              />

            </div>





            <div className="form-group">

              <label className="form-label">
                Requirements
              </label>


              <textarea
                className="form-input"
                rows="5"
                value={requirements}
                onChange={
                  e =>
                    setRequirements(
                      e.target.value
                    )
                }
              />

            </div>





            {price &&
              !price.error && (

              <div
                className="price-display"
              >

                Estimated Price:

                <h2>
                  ${price.total}
                </h2>


                {price.days} days until deadline

              </div>

            )}






            <button
              className="btn btn-primary btn-lg"
              style={{
                width:'100%',
                marginTop:'2rem'
              }}
              disabled={
                submitting ||
                !price ||
                price.error
              }
            >

              {
                submitting
                  ? 'Placing Order...'
                  : 'Place Order'
              }


            </button>



          </form>



        </div>


      </div>


    </div>

  );

}